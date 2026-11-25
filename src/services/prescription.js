import { ref } from 'vue'
import { useStaticData } from './data-source'
import { staticSession, staticPrescription } from './static-prescription'
import { apiMessage, apiError } from './api-message'
import { canUseAction, canUseBusiness } from './permissions'

const env = import.meta.env
const SESSION_KEY = 'pharmacy-pda-session'
const responseMessages = new WeakMap()
const sessionVersion = ref(0)
let loginError = ''

export function responseError(data, fallback) {
  const message = apiMessage(data, { errorOnly: true }) ||
    (data && typeof data === 'object' ? responseMessages.get(data) : '')
  return apiError(message, fallback)
}

export function consumeLoginError() {
  const message = loginError
  loginError = ''
  return message
}

export function getSession() {
  void sessionVersion.value
  if (useStaticData) return { ...staticSession }
  const saved = uni.getStorageSync(SESSION_KEY) || {}
  return {
    hospitalCode: env.VITE_HOSPITAL_CODE || '',
    hospitalName: env.VITE_HOSPITAL_NAME || '',
    wardName: env.VITE_WARD_NAME || '',
    operatorName: '',
    operatorId: '',
    department: '',
    ...saved,
    wardCode: saved.wardName ?? env.VITE_WARD_NAME ?? ''
  }
}

export function saveSession(session) {
  uni.setStorageSync(SESSION_KEY, session)
  sessionVersion.value++
  uni.$emit('pharmacy-session-changed')
}

export function clearSession() {
  uni.removeStorageSync(SESSION_KEY)
  sessionVersion.value++
  uni.$emit('pharmacy-session-ended')
}

export function logout(message = '') {
  loginError = message
  clearSession()
  uni.reLaunch({ url: '/pages/login/index' })
}

export function isLoggedIn() {
  const session = getSession()
  const business = session.business === 'inpatient' ? 'inpatient' : 'outpatient'
  const inpatientOnly = !canUseBusiness('outpatient', session) && canUseBusiness('inpatient', session)
  return !!(session.token && session.hospitalCode && session.hospitalName && !session.hospitalSelectionRequired &&
    canUseBusiness(business, session) && (!inpatientOnly || session.wardName?.trim()))
}

export function requestPrescription(path, data, session = getSession()) {
  if (useStaticData) return staticPrescription(path, data)
  const setupRequest = ['/preInstitutionInfo/list', '/setting/GetCurrentUserType'].includes(path)
  const recordsRequest = ['/pharmacy/dispense/records', '/pharmacy/acceptance/records'].includes(path)
  const baseUrl = (setupRequest || recordsRequest ? '/api2/axd' : (env.VITE_PRESCRIPTION_API_BASE || '/api2/axd')).replace(/\/$/, '')
  return new Promise((resolve, reject) => {
    if (!session.token) { reject(new Error('请先登录')); return }
    if (!setupRequest && (!session.hospitalCode || !session.hospitalName || session.hospitalSelectionRequired)) {
      reject(new Error('请先选择医疗机构')); return
    }
    if (!setupRequest) {
      const business = String(data.mode) === '2' ? 'inpatient' : String(data.mode) === '1' ? 'outpatient' : session.business
      const kind = path.startsWith('/hospital-acceptance/') || path.startsWith('/pharmacy/acceptance/') ? 'accept' : 'dispense'
      const permitted = path === '/pharmacy/scan/resolve'
        ? canUseBusiness(business, session)
        : canUseAction(kind, business, session)
      if (!permitted) { reject(new Error('暂无该业务权限，请联系管理员')); return }
    }
    if (data.mode === '2' && path.includes('/ward-receive/') && !data.wardCode && !data.wardName) {
      reject(new Error('请先填写病区名称')); return
    }
    uni.request({
      url: `${baseUrl}${path}`,
      method: 'POST',
      data,
      timeout: 20000,
      withCredentials: true,
      header: {
        ...session.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Access-Token': session.token,
        WeAppAuthorization: session.token
      },
      success: response => {
        const body = response.data
        const expired = response.statusCode === 401 || response.statusCode === 403 || body?.code === 403 ||
          /重新登|尚未登录/.test(apiMessage(body)) || (body?.code === 1000 && /未登录|无权限/.test(apiMessage(body)))
        if (response.statusCode < 200 || response.statusCode >= 300 || !body || body.code !== 0 || expired) {
          const error = apiError(apiMessage(body, { errorOnly: true }), `接口请求失败（HTTP ${response.statusCode}）`)
          error.code = body?.code
          if (expired && getSession().token === session.token) logout(error.message)
          if (body?.code === 6109 && path.endsWith('/confirm')) uni.$emit('pharmacy-conflict')
          reject(error)
          return
        }
        const result = path === '/setting/GetCurrentUserType' && body.data === null
          ? { orgType: 1 }
          : body.data ?? {}
        if (typeof result === 'object' && result !== null) {
          for (const key of ['accepted', 'dispensed', 'alreadyDispensed', 'received', 'alreadyReceived', 'verified']) {
            if (typeof result[key] !== 'string') continue
            const value = result[key].trim().toLowerCase()
            if (value === 'true' || value === 'false') result[key] = value === 'true'
          }
          responseMessages.set(result, apiMessage(body, { errorOnly: true }))
        }
        resolve(result)
      },
      fail: () => reject(new Error('网络请求失败，请检查网络连接后重新查询'))
    })
  })
}

export const prescriptionApi = {
  currentUserType: (body, session) => requestPrescription('/setting/GetCurrentUserType', body, session),
  institutionList: (body, session) => requestPrescription('/preInstitutionInfo/list', body, session),
  acceptanceRecords: (body, session) => requestPrescription('/pharmacy/acceptance/records', body, session),
  dispenseRecords: (body, session) => requestPrescription('/pharmacy/dispense/records', body, session),
  hospitalAcceptanceQuery: (body, session) => requestPrescription('/hospital-acceptance/query', body, session),
  hospitalAcceptanceConfirm: (body, session) => requestPrescription('/hospital-acceptance/confirm', body, session),
  acceptanceToday: (body, session) => requestPrescription('/pharmacy/acceptance/today', body, session),
  scanResolve: (body, session) => requestPrescription('/pharmacy/scan/resolve', body, session),
  acceptancePage: (body, session) => requestPrescription('/pharmacy/acceptance/page', body, session),
  acceptanceConfirm: (body, session) => requestPrescription('/pharmacy/acceptance/confirm', body, session),
  visitStart: (body, session) => requestPrescription('/pharmacy/outpatient/visit/start', body, session),
  prescriptionVerify: (body, session) => requestPrescription('/pharmacy/outpatient/prescription/verify', body, session),
  dispensePage: (body, session) => requestPrescription('/pharmacy/dispense/page', body, session),
  dispenseConfirm: (body, session) => requestPrescription('/pharmacy/dispense/confirm', body, session),
  dispenseToday: (body, session) => requestPrescription('/pharmacy/dispense/today', body, session),
  wardReceivePage: (body, session) => requestPrescription('/pharmacy/ward-receive/page', body, session),
  wardReceiveConfirm: (body, session) => requestPrescription('/pharmacy/ward-receive/confirm', body, session),
  wardReceiveToday: (body, session) => requestPrescription('/pharmacy/ward-receive/today', body, session)
}
