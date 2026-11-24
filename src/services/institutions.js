import { getSession, saveSession, prescriptionApi, responseError } from './prescription'

export async function selectDefaultHospital(session = getSession()) {
  const userType = await prescriptionApi.currentUserType({}, session)
  if (getSession().token !== session.token) throw new Error('登录已变化，请重新登录')
  const hospitals = await loadHospitals(session)
  const orgType = Number(userType.orgType)
  if (![1, 2, 3, 4].includes(orgType)) throw responseError(userType, '未获取到有效的用户机构类型，请联系管理员')
  const hosCode = String(userType.hosCode ?? '').trim()
  const selected = orgType === 1 ? hospitals[0] : hospitals.find(row => row.hospitalCode === hosCode)
  if (!selected) throw new Error(orgType === 1 ? '暂无可用医疗机构，请联系管理员' : '当前用户所属医院与机构列表不匹配，请联系管理员')
  const current = getSession()
  if (current.token !== session.token) throw new Error('登录已变化，请重新登录')
  saveSession({ ...current, orgType, hosCode, hospitalCode: selected.hospitalCode, hospitalName: selected.hospitalName, hospitalSelectionRequired: false })
  return selected
}

export async function loadHospitals(session = getSession()) {
  const hospitals = new Map()
  let pages = 1
  for (let pageNum = 1; pageNum <= pages; pageNum++) {
    if (getSession().token !== session.token) throw new Error('登录已变化，请重新登录')
    const data = await prescriptionApi.institutionList({ pageNum, pageSize: 100 }, session)
    if (getSession().token !== session.token) throw new Error('登录已变化，请重新登录')
    if (!Array.isArray(data.records)) throw responseError(data, '机构列表响应格式异常，请重新加载')
    // Keep only the display fields; institution responses can contain credentials.
    for (const row of data.records) {
      const institutionType = String(row.jglx ?? '').trim()
      const hospitalCode = String(row.jgdm ?? '').trim()
      const hospitalName = typeof row.jgmc === 'string' ? row.jgmc.trim() : ''
      if ((institutionType && Number(institutionType) !== 1) || !hospitalCode || !hospitalName) continue
      hospitals.set(hospitalCode, { hospitalCode, hospitalName, label: `${hospitalName}（${hospitalCode}）` })
    }
    if (pageNum === 1) {
      const count = Number(data.pages ?? Math.ceil(Number(data.total ?? data.records.length) / Number(data.size || 100)))
      if (!Number.isSafeInteger(count) || count < 0) throw responseError(data, '机构分页信息异常，请重新加载')
      pages = count
    }
  }
  return [...hospitals.values()]
}
