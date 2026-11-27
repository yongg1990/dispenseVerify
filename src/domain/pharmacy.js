import { reactive, computed } from 'vue'
import { useStaticData } from '../services/data-source'
import { getSession, saveSession, prescriptionApi as api, responseError } from '../services/prescription'
import { canUseAction, canUseBusiness, canAccessPage } from '../services/permissions'

export const hospital = reactive({ id: '', name: '--', department: '中药房' })
export const currentWard = reactive({ id: '', name: '--', station: '--' })
export const state = reactive({ business: getSession().business === 'inpatient' ? 'inpatient' : 'outpatient', rows: [], records: [], acceptanceRows: [], dispenseRows: [], wardRows: [], pendingAcceptanceCount: null, pendingWardCount: null, todayAcceptanceCount: null, todayDispenseCount: null, todayReceiveCount: null, acceptanceStatDate: '', dispenseStatDate: '', receiveStatDate: '', contextKey: '' })
const actor = reactive({ id: '--', name: '--', department: '--' })
export const operator = computed(() => actor)
export const businessLabel = computed(() => state.business === 'outpatient' ? '门诊' : '住院')
export const statusLabels = { packed: '待验收', accepted: '已验收', dispensed: '已发药', cancelled: '已退方', withdrawn: '已撤回', 1: '待确认', 2: '已撤回待确认', 3: '已确认', 4: '已发送', 5: '代煎已核方', 6: '已配方', 7: '已浸泡', 8: '已煎煮', 9: '已打包', 10: '已快递', 11: '已签收', 12: '已退方', 13: '已验收', 14: '已发药', 15: '病区已接收' }
export const dayKey = (date = new Date()) => {
  const p = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}
export const formatTime = value => value || '--'
function clearData() {
  state.rows = []; state.records = []; state.acceptanceRows = []; state.dispenseRows = []; state.wardRows = []
  state.pendingAcceptanceCount = null; state.pendingWardCount = null; state.todayAcceptanceCount = null; state.todayDispenseCount = null; state.todayReceiveCount = null
  state.acceptanceStatDate = ''; state.dispenseStatDate = ''; state.receiveStatDate = ''
}
uni.$on('pharmacy-session-ended', () => { clearData(); state.contextKey = ''; hospital.id = ''; hospital.name = '--'; currentWard.id = ''; currentWard.name = '--'; actor.id = '--'; actor.name = '--' })
export function requestContext() {
  const session = getSession()
  const mode = state.business === 'outpatient' ? '1' : '2'
  const key = JSON.stringify([session.hospitalCode, session.wardCode, session.wardName, session.operatorId, session.token, session.headers, mode])
  if (state.contextKey !== key) { clearData(); state.contextKey = key }
  hospital.id = session.hospitalCode || ''; hospital.name = session.hospitalName || '--'
  currentWard.id = session.wardCode || ''; currentWard.name = session.wardName || '--'
  currentWard.station = session.wardName ? `${session.wardName}护理站` : '--'
  actor.id = session.operatorId || '--'; actor.name = session.operatorName || '--'; actor.department = session.department || '--'
  return { key, session, body: { hospitalCode: hospital.id, mode, ...(mode === '2' ? { ...(currentWard.id ? { wardCode: currentWard.id } : {}), ...(session.wardName ? { wardName: session.wardName } : {}) } : {}) } }
}
function assertCurrent(ctx) {
  if (requestContext().key !== ctx.key) throw new Error('业务或登录上下文已切换，请重新操作')
}
function requireWard(ctx) { if (!ctx.body.wardCode && !ctx.body.wardName) throw new Error('请先选择病区') }
export function matchesCurrentWard(row) {
  const session = getSession()
  return session.wardCode
    ? !!row.wardCode && String(row.wardCode) === String(session.wardCode)
    : !!session.wardName?.trim() && !!row.wardName && row.wardName.trim() === session.wardName.trim()
}
export function can(kind) { return canUseAction(kind, state.business, getSession()) }
function keywordOf(value) {
  const keyword = value.trim()
  if (keyword.length > 100) throw new Error('查询内容最多100个字符')
  return keyword
}
function rawCode(code) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('请扫描或输入二维码内容')
  return code
}
export function hasRecordData(row) {
  if (!row || typeof row !== 'object') return false
  return ['recordId', 'executionRecordId', 'logisticsRecordId', 'packageCode', 'scanCode', 'patientName', 'prescriptionNo', 'registrationNo', 'inpatientNo', 'bedNo'].some(key => {
    const value = row[key]
    return (typeof value === 'string' || typeof value === 'number') && !['', '-', '--', 'null', 'undefined'].includes(String(value).trim())
  })
}
async function fetchPages(method, body, ctx) {
  const first = await method({ ...body, pageNum: 1, pageSize: 100 }, ctx.session)
  const records = [...(first.records || [])]
  const pages = Number(first.pages ?? Math.ceil(Number(first.total ?? records.length) / 100))
  for (let pageNum = 2; pageNum <= pages; pageNum++) {
    assertCurrent(ctx)
    const next = await method({ ...body, pageNum, pageSize: 100 }, ctx.session)
    records.push(...(next.records || []))
  }
  assertCurrent(ctx)
  return { ...first, records: records.filter(hasRecordData) }
}
export function mapPrescription(raw) {
  return {
    ...raw, id: JSON.stringify([raw.recordId, raw.executionRecordId ?? null, raw.logisticsRecordId ?? null, raw.packageCode ?? null]),
    business: state.business, hospitalId: hospital.id, name: raw.patientName ?? '--', no: raw.prescriptionNo ?? '--',
    gender: raw.patientGender ?? raw.patientSex ?? raw.gender ?? raw.sex ?? '--', age: raw.patientAge ?? raw.age ?? '',
    registrationNo: raw.registrationNo ?? '--', inpatientNo: raw.inpatientNo ?? '', dose: raw.doseCount ?? '--', way: ({ '3': '代煎来院自取', '5': '自煎来院自取', '2': '代煎快递', '4': '自煎快递' })[raw.pickupType] ?? raw.pickupType ?? '--',
    bed: raw.bedNo ?? '', wardId: raw.wardCode ?? raw.ward ?? '', wardCode: raw.wardCode ?? raw.ward ?? '', wardName: raw.wardName ?? raw.wardCode ?? raw.ward ?? '', route: raw.route ?? '--', frequency: raw.frequency ?? '--',
    packageCode: raw.packageCode ?? raw.executionRecordId ?? raw.scanCode ?? '--',
    batch: raw.executionRecordId ?? '--', split: !!raw.executionRecordId, prescriptionDate: raw.prescriptionDate ?? '--',
    acceptedAt: raw.acceptedAt ?? '', acceptedBy: raw.acceptedByName ?? '--', smsSent: raw.smsSent === true,
    receivedAt: raw.receivedAt ?? '', ingredients: raw.ingredients ?? []
  }
}
function storeRows(records) {
  return records.map(raw => {
    const mapped = mapPrescription(raw)
    const existing = state.rows.find(row => row.id === mapped.id)
    if (existing) { Object.assign(existing, mapped); return existing }
    state.rows.push(mapped)
    return state.rows[state.rows.length - 1]
  })
}
export const defaultDispenseRows = computed(() => state.dispenseRows)
export const visibleRecords = kind => state.records.filter(row => row.kind === kind).sort((a, b) => b.time.localeCompare(a.time))
export const todayRecords = kind => visibleRecords(kind)
export function todayCount(kind) {
  if (kind === 'accept') return state.todayAcceptanceCount ?? '--'
  if (kind === 'receive') return state.todayReceiveCount ?? '--'
  if (kind === 'dispense') return state.todayDispenseCount ?? '--'
  return '--'
}
export function switchBusiness(value) {
  const session = getSession()
  if (!canUseBusiness(value, session)) throw new Error('暂无该业务权限，请联系管理员')
  state.business = value
  if (session.business !== value) saveSession({ ...session, business: value })
  requestContext()
}
export async function loadAcceptance(keyword = '') {
  const ctx = requestContext()
  const data = await fetchPages(api.acceptancePage, { ...ctx.body, ...(keyword ? { keyword: keywordOf(keyword) } : {}) }, ctx)
  const rows = storeRows(data.records)
  if (!keyword) { state.acceptanceRows = rows; state.pendingAcceptanceCount = data.pendingCount ?? data.total ?? rows.length }
  return rows
}
export async function findPackage(code) {
  const ctx = requestContext()
  const data = await api.scanResolve({ ...ctx.body, scanType: 'PACKAGE', scanCode: rawCode(code) }, ctx.session)
  assertCurrent(ctx)
  if (data.requiresHISMapping && !data.candidates?.length) throw responseError(data, '请确认 HIS 已同步条码映射')
  const candidates = data.candidates || []
  const pending = await loadAcceptance()
  assertCurrent(ctx)
  const rows = pending.filter(row => candidates.some(candidate =>
    candidate.recordId === row.recordId &&
    (candidate.executionRecordId ?? null) === (row.executionRecordId ?? null) &&
    (!candidate.logisticsRecordId || candidate.logisticsRecordId === row.logisticsRecordId)))
  if (!rows.length) throw responseError(data, '未找到待验收药包，请检查二维码内容')
  return rows
}
export async function acceptPackage(id, smsReminder = true) {
  const ctx = requestContext()
  const row = state.rows.find(item => item.id === id)
  if (!row?.recordId) throw new Error('缺少接口返回的处方记录ID，请重新加载')
  if (row.canAccept === false) throw new Error(row.acceptanceBlockedReason || '当前药包不可验收')
  const data = await api.acceptanceConfirm({ ...ctx.body, recordId: row.recordId, executionRecordId: row.executionRecordId ?? null, ...(row.logisticsRecordId ? { logisticsRecordId: row.logisticsRecordId } : {}), ...(row.waybillNo ? { waybillNo: row.waybillNo } : {}), smsReminder: smsReminder === true }, ctx.session)
  assertCurrent(ctx)
  if (data.accepted !== true) throw responseError(data, '接口未返回验收成功，请重新查询药包状态')
  row.accepted = true
  row.smsSent = data.smsSent === true
  if (useStaticData) Object.assign(row, mapPrescription(data))
  return data
}
export async function searchDispense(value = '') {
  const ctx = requestContext(); const keyword = keywordOf(value)
  if (ctx.body.mode === '2') requireWard(ctx)
  const data = await fetchPages(api.dispensePage, { ...ctx.body, ...(keyword ? { keyword, searchType: 'NAME' } : {}) }, ctx)
  assertCurrent(ctx)
  const unique = new Map()
  for (const raw of data.records) unique.set(JSON.stringify([raw.recordId, raw.executionRecordId ?? null]), raw)
  state.dispenseRows = storeRows([...unique.values()])
  return state.dispenseRows
}
export async function findPatient(code) {
  const ctx = requestContext()
  if (ctx.body.mode !== '1') throw new Error('当前页面仅支持门诊双扫码发药')
  const data = await api.visitStart({ ...ctx.body, scanCode: rawCode(code) }, ctx.session)
  assertCurrent(ctx)
  if (!data.scanToken) throw responseError(data, '接口未返回扫码核验凭证，请重新扫描就诊码')
  const candidates = (data.candidates || []).filter(hasRecordData).map(raw => mapPrescription({
    ...state.dispenseRows.find(row => row.recordId === raw.recordId && (row.executionRecordId ?? null) === (raw.executionRecordId ?? null)),
    ...raw
  }))
  return { ...data, name: data.patientName ?? '--', registrationNo: data.registrationNo || '--', candidates }
}
export async function verifyPrescription(scanToken, code) {
  const ctx = requestContext()
  if (ctx.body.mode !== '1') throw new Error('当前页面仅支持门诊双扫码发药')
  const data = await api.prescriptionVerify({ ...ctx.body, scanToken, scanCode: rawCode(code) }, ctx.session)
  assertCurrent(ctx)
  if (data.verified !== true || !data.recordId) throw responseError(data, '处方扫码核验未通过，请重新扫描就诊码')
  return data
}
export async function dispensePackage(row, scanToken, { manual = false } = {}) {
  const ctx = requestContext()
  if (!row?.recordId) throw new Error('缺少接口返回的处方记录ID，请重新加载')
  if (row.hospitalId !== ctx.body.hospitalCode || row.business !== state.business) throw new Error('业务或医院已切换，请重新扫描药包')
  if (ctx.body.mode === '2') {
    requireWard(ctx)
    if (!matchesCurrentWard(row)) throw new Error('药包病区与当前病区不一致，禁止发药')
  } else if (!scanToken && !manual) throw new Error('请先完成就诊码和处方二维码双扫码核验')
  const data = await api.dispenseConfirm({
    ...ctx.body, ...(ctx.body.mode === '2' && row.wardCode ? { wardCode: row.wardCode } : {}), recordId: row.recordId, executionRecordId: row.executionRecordId ?? null,
    ...(ctx.body.mode === '1' ? { scanToken } : {}),
    ...(manual && useStaticData ? { manual: true } : {})
  }, ctx.session)
  assertCurrent(ctx)
  if (data.dispensed !== true && data.alreadyDispensed !== true) throw responseError(data, '接口未返回发药成功，请重新查询处方状态')
  return data
}
export async function loadWardPending(keyword = '') {
  const ctx = requestContext(); requireWard(ctx)
  const data = await fetchPages(api.wardReceivePage, { ...ctx.body, mode: '2', ...(keyword ? { keyword: keywordOf(keyword) } : {}) }, ctx)
  const rows = storeRows(data.records)
  if (!keyword) { state.wardRows = rows; state.pendingWardCount = data.pendingCount ?? data.total ?? rows.length }
  return rows
}
export async function findWardPackage(code, purpose = 'dispense') {
  const ctx = requestContext(); requireWard(ctx)
  const data = await api.scanResolve({ ...ctx.body, scanType: 'PACKAGE', scanCode: rawCode(code) }, ctx.session)
  assertCurrent(ctx)
  const candidates = data.candidates || []
  if (!candidates.length) throw responseError(data, data.requiresHISMapping ? '该药包尚未完成HIS映射' : '未找到药包，请检查二维码内容')
  if (candidates.length !== 1) throw responseError(data, '存在多个处方或执行批次，请扫描具体药包二维码')
  const pending = purpose === 'receive' ? await loadWardPending() : await searchDispense()
  assertCurrent(ctx)
  const candidate = candidates[0]
  const detail = pending.find(row => row.recordId === candidate.recordId && (row.executionRecordId ?? null) === (candidate.executionRecordId ?? null))
  if (!detail) throw responseError(data, purpose === 'receive' ? '该批次不在当前病区待接收列表中' : '该批次不在待发药列表中')
  const row = mapPrescription({ ...detail, ...candidate, wardCode: candidate.wardCode ?? detail.wardCode, scanCode: code })
  if (!row.recordId) throw responseError(data, '扫码接口未返回处方记录ID')
  if (!matchesCurrentWard(row)) throw responseError(data, '药包病区与当前病区不一致')
  return row
}
export async function receivePackage(row) {
  const ctx = requestContext(); requireWard(ctx)
  if (!row?.recordId) throw new Error('缺少处方记录ID，请重新扫码')
  if (row.business !== 'inpatient' || row.hospitalId !== ctx.body.hospitalCode || !matchesCurrentWard(row)) throw new Error('医院、业务或病区已切换，请重新扫码')
  const data = await api.wardReceiveConfirm({ ...ctx.body, ...(row.wardCode ? { wardCode: row.wardCode } : {}), mode: '2', recordId: row.recordId, executionRecordId: row.executionRecordId ?? null }, ctx.session)
  assertCurrent(ctx)
  if (data.received !== true && data.alreadyReceived !== true) throw responseError(data, '接口未返回接收成功，请重新查询药包状态')
  return data
}
export async function loadToday(kind = 'dispense') {
  const ctx = requestContext()
  if (ctx.body.mode === '2') requireWard(ctx)
  const receive = kind === 'receive'
  const accept = kind === 'accept'
  const data = await fetchPages(accept ? api.acceptanceToday : receive ? api.wardReceiveToday : api.dispenseToday, { ...ctx.body, ...(receive ? { mode: '2' } : {}) }, ctx)
  const records = data.records.map((raw, index) => ({ ...mapPrescription(raw), kind, entryId: JSON.stringify([kind, raw.recordId, raw.executionRecordId, raw.packageCode, index]), time: (accept ? raw.acceptedAt : receive ? raw.receivedAt : raw.dispensedAt) || '--', operator: (accept ? raw.acceptedByName : receive ? raw.receivedByName : raw.dispensedByName) || '--' }))
  state.records = [...state.records.filter(row => row.kind !== kind), ...records]
  if (accept) { state.todayAcceptanceCount = data.todayCount ?? data.total ?? records.length; state.acceptanceStatDate = data.statDate || ''; return data }
  if (receive) { state.todayReceiveCount = data.todayCount ?? data.total ?? records.length; state.receiveStatDate = data.statDate || '' }
  else { state.todayDispenseCount = data.todayCount ?? data.total ?? records.length; state.dispenseStatDate = data.statDate || '' }
  return data
}
export async function loadRecordPage(kind, { startTime, endTime, patientName = '', pageNum, pageSize = 20 }) {
  if (!['accept', 'dispense'].includes(kind)) throw new Error('不支持的明细类型')
  if (!startTime || !endTime || startTime > endTime) throw new Error('开始日期不能晚于结束日期')
  const ctx = requestContext()
  const method = kind === 'accept' ? api.acceptanceRecords : api.dispenseRecords
  const name = keywordOf(patientName)
  const data = await method({ hospitalCode: ctx.body.hospitalCode, mode: ctx.body.mode, startTime, endTime, ...(name ? { patientName: name } : {}), pageNum, pageSize }, ctx.session)
  assertCurrent(ctx)
  if (!Array.isArray(data.records)) throw responseError(data, '明细列表响应格式异常，请重新查询')
  const records = data.records.filter(hasRecordData).map((raw, index) => ({
    ...mapPrescription(raw), kind,
    entryId: JSON.stringify([kind, raw.recordId, raw.executionRecordId, raw.logisticsRecordId, raw.packageCode, pageNum, index]),
    time: (kind === 'accept' ? raw.acceptedAt : raw.dispensedAt) || '--',
    operator: (kind === 'accept' ? raw.acceptedByName : raw.dispensedByName) || '--'
  }))
  const total = data.total == null ? null : Number(data.total)
  const pages = data.pages == null ? null : Number(data.pages)
  const hasMore = data.records.length > 0 && (
    Number.isSafeInteger(pages) && pages >= 0 ? pageNum < pages :
      Number.isSafeInteger(total) && total >= 0 ? pageNum * pageSize < total : data.records.length >= pageSize
  )
  return { records, total: Number.isSafeInteger(total) && total >= 0 ? total : null, hasMore }
}
export async function refreshOverview() {
  requestContext()
  await refreshRequests([
    ...(can('accept') ? [() => loadAcceptance(), () => loadToday('accept')] : []),
    ...(can('dispense') ? [() => loadToday('dispense'), () => searchDispense(), ...(state.business === 'inpatient' ? [() => loadWardPending(), () => loadToday('receive')] : [])] : [])
  ])
}
export async function refreshRequests(tasks) {
  const results = await Promise.allSettled(tasks.map(task => task()))
  const failure = results.find(result => result.status === 'rejected' && result.reason?.isApiError) ||
    results.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
}
export function toast(message) { uni.showToast({ title: message, icon: 'none', duration: 2000 }) }
export function navigate(path) {
  const target = path === 'dispense' && state.business === 'inpatient' ? 'inpatient-dispense' : path
  if (!canAccessPage(target, state.business, getSession())) { toast('暂无该页面访问权限'); return }
  uni.navigateTo({ url: `/pages/${target}/index` })
}
