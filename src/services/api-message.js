const successMessage = /^(成功|操作成功|请求成功|success|ok)$/i

export function apiMessage(body, { rpc = false, errorOnly = false } = {}) {
  const messages = rpc
    ? [body?.error?.message, body?.msg, body?.message]
    : [body?.msg, body?.message, body?.error?.message]
  for (const message of messages) {
    if (typeof message === 'string' && message.trim() && (!errorOnly || !successMessage.test(message.trim()))) return message
  }
  for (const nested of [body?.data, body?.result]) {
    if (nested && typeof nested === 'object' && nested !== body) {
      const message = apiMessage(nested, { rpc, errorOnly })
      if (message) return message
    }
  }
  return ''
}

export function apiError(message, fallback) {
  const error = new Error(message || fallback)
  error.isApiError = !!message
  return error
}
