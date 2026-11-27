import { getSession, prescriptionApi, responseError } from './prescription'

export async function loadWardOptions(hospitalName, session = getSession()) {
  if (!hospitalName) throw new Error('请先选择医疗机构')
  const data = await prescriptionApi.departmentList({ hospitalName }, session)
  const current = getSession()
  if (current.token !== session.token || current.hospitalCode !== session.hospitalCode) {
    throw new Error('登录或医疗机构已变化，请重新选择病区')
  }
  if (!Array.isArray(data)) throw responseError(data, '科室列表响应格式异常，请重新加载')

  const nodes = new Map()
  for (const row of data) {
    const code = String(row?.locCode ?? row?.loccode ?? '').trim()
    if (!code || nodes.has(code)) continue
    nodes.set(code, { value: code, text: String(row.locName ?? row.locname ?? '').trim() || code, children: [] })
  }

  const tree = []
  for (const node of nodes.values()) {
    // Use the longest existing prefix so missing intermediate levels are supported.
    let parent
    for (let length = node.value.length - 1; length > 0; length--) {
      parent = nodes.get(node.value.slice(0, length))
      if (parent) break
    }
    if (parent) parent.children.push(node)
    else tree.push(node)
  }
  const standaloneCodes = new Set(tree.filter(node => !node.children.length).map(node => node.value))
  return {
    tree: tree.filter(node => node.children.length),
    leaves: new Map([...nodes].filter(([code, node]) => !node.children.length && !standaloneCodes.has(code)))
  }
}
