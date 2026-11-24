import { encryptPassword } from '../utils/encrypt-password'
import { getSession, saveSession, logout } from './prescription'
import { apiMessage, apiError } from './api-message'
import { canUseBusiness } from './permissions'

const userApi = import.meta.env.VITE_BAAS_USER_API || '/api/system/user'

function userRpc(method, params, session) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: userApi,
      method: 'POST',
      data: { id: '1', jsonrpc: '2.0', method, params },
      timeout: 60000,
      header: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(session?.token ? { 'Access-Token': session.token, WeAppAuthorization: session.token } : {})
      },
      success: response => {
        const body = response.data
        const expired = (response.statusCode === 401 && !body?.result?.isLogin) ||
          (typeof body?.msg === 'string' && /重新登|尚未登录/.test(body.msg))
        if (response.statusCode < 200 || response.statusCode >= 300 || !body || typeof body !== 'object' || body.error || expired) {
          const error = apiError(apiMessage(body, { rpc: true, errorOnly: true }), `登录服务请求失败（HTTP ${response.statusCode}）`)
          if (expired && session?.token && getSession().token === session.token) logout(error.message)
          reject(error)
          return
        }
        resolve(body)
      },
      fail: () => reject(new Error('无法连接登录服务，请检查网络后重试'))
    })
  })
}

function storeLogin(body, context) {
  const result = body.result
  if (typeof result?.sessionKey !== 'string' || !result.sessionKey.trim() ||
      !result.user || typeof result.user !== 'object' || Array.isArray(result.user) ||
      typeof result.user.userName !== 'string' || !result.user.userName.trim()) {
    throw apiError(apiMessage(body, { rpc: true, errorOnly: true }), '登录响应缺少有效会话或用户信息')
  }
  const accessSession = { loginInfo: result }
  if (!canUseBusiness('outpatient', accessSession) && !canUseBusiness('inpatient', accessSession)) {
    throw apiError(apiMessage(body, { rpc: true, errorOnly: true }), '暂无访问权限! 请联系管理员')
  }
  saveSession({
    ...context,
    business: canUseBusiness('outpatient', accessSession) ? 'outpatient' : 'inpatient',
    wardCode: '',
    wardName: '',
    hospitalCode: '',
    hospitalName: '',
    hospitalSelectionRequired: true,
    token: result.sessionKey,
    operatorId: result.user.userId ?? '',
    operatorName: result.user.userName,
    loginInfo: result,
    passwordExpired: result.IsPWDExpiration === true,
    passwordExpirationMessage: result.PWDExpirationMsg || ''
  })
  return result
}

export async function loginWithPassword(loginName, password, context) {
  if (!loginName.trim()) throw new Error('请输入登录账号')
  if (!password) throw new Error('请输入密码')
  const body = await userRpc('Login', [{
    loginName: loginName.trim(),
    password: encryptPassword(password),
    productId: 6
  }])
  return storeLogin(body, context)
}

export async function logoutUser() {
  const session = getSession()
  try {
    if (session.token) await userRpc('Logout', [], session)
  } finally {
    if (getSession().token === session.token) logout()
  }
}
