import { useStaticData } from './data-source'
import { staticSession, staticPrescription } from './static-prescription'

const env = import.meta.env
const SESSION_KEY = 'pharmacy-pda-session'
const responseMessages = new WeakMap()

function apiMessage(body) {
  return [body?.msg, body?.message].find(value => typeof value === 'string' && value.trim()) || ''
}

export function responseError(data, fallback) {
  const message = apiMessage(data) || responseMessages.get(data)
  return new Error(message && !/^(成功|操作成功|请求成功|success|ok)$/i.test(message.trim()) ? message : fallback)
}

export function getSession() {
  if (useStaticData) return { ...staticSession }
  const saved = uni.getStorageSync(SESSION_KEY) || {}
  return {
    hospitalCode: env.VITE_HOSPITAL_CODE || '',
    hospitalName: env.VITE_HOSPITAL_NAME || '',
    wardCode: env.VITE_WARD_CODE || '',
    wardName: env.VITE_WARD_NAME || '',
    operatorName: '',
    operatorId: '',
    department: '',
    ...saved
  }
}

export function requestPrescription(path, data, session = getSession()) {
  if (useStaticData) return staticPrescription(path, data)
  const baseUrl = (env.VITE_PRESCRIPTION_API_BASE || '/api/prescription').replace(/\/$/, '')
  return new Promise((resolve, reject) => {
    if (!data.hospitalCode) { reject(new Error('缺少当前医院编码，请先由登录系统提供医院上下文')); return }
    if (data.mode === '2' && path.includes('/ward-receive/') && !data.wardCode) {
      reject(new Error('缺少当前授权病区编码')); return
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
        ...(session.authorization ? { Authorization: session.authorization } : {})
      },
      success: response => {
        const body = response.data
        if (response.statusCode < 200 || response.statusCode >= 300 || !body || body.code !== 0) {
          const error = new Error(apiMessage(body) || apiMessage(body?.data) || `接口请求失败（HTTP ${response.statusCode}）`)
          error.code = body?.code
          reject(error)
          return
        }
        const result = body.data ?? {}
        if (typeof result === 'object' && result !== null) responseMessages.set(result, apiMessage(body))
        resolve(result)
      },
      fail: () => reject(new Error('网络请求失败，请检查网络连接后重新查询'))
    })
  })
}

export const prescriptionApi = {
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
