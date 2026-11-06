import { reactive, computed } from 'vue'
import { useStaticData } from '../services/data-source'
import { getSession, prescriptionApi as api, responseError } from '../services/prescription'

export const hospital = reactive({ id: '', name: '--', department: '中药房' })
export const currentWard = reactive({ id: '', name: '--', station: '--' })
export const state = reactive({ business: 'outpatient', rows: [], records: [], acceptanceRows: [], dispenseRows: [], wardRows: [], pendingAcceptanceCount: null, pendingWardCount: null, todayDispenseCount: null, todayReceiveCount: null, dispenseStatDate: '', receiveStatDate: '', contextKey: '' })
const actor = reactive({ id: '--', name: '--', department: '--' })
export const operator = computed(() => actor)
export const businessLabel = computed(() => state.business === 'outpatient' ? '门诊' : '住院')
export const statusLabels = { packed: '待验收', accepted: '已验收', dispensed: '已发药', cancelled: '已退方', withdrawn: '已撤回' }
export const dayKey = (date = new Date()) => {
  const p = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}
export const formatTime = value => value || '--'
function clearData() {
  state.rows = []; state.records = []; state.acceptanceRows = []; state.dispenseRows = []; state.wardRows = []
  state.pendingAcceptanceCount = null; state.pendingWardCount = null; state.todayDispenseCount = null; state.todayReceiveCount = null
  state.dispenseStatDate = ''; state.receiveStatDate = ''
}
export function requestContext() {
  const session = getSession()
  const mode = state.business === 'outpatient' ? '1' : '2'
  const key = JSON.stringify([session.hospitalCode, session.wardCode, session.operatorId, session.authorization, session.headers, mode])
  if (state.contextKey !== key) { clearData(); state.contextKey = key }
  hospital.id = session.hospitalCode || ''; hospital.name = session.hospitalName || '--'
  currentWard.id = session.wardCode || ''; currentWard.name = session.wardName || '--'
  currentWard.station = session.wardName ? `${session.wardName}护理站` : '--'
  actor.id = session.operatorId || '--'; actor.name = session.operatorName || '--'; actor.department = session.department || '--'
  return { key, session, body: { hospitalCode: hospital.id, mode, ...(mode === '2' && currentWard.id ? { wardCode: currentWard.id } : {}) } }
}
function assertCurrent(ctx) {
  if (requestContext().key !== ctx.key) throw new Error('业务或登录上下文已切换，请重新操作')
}
function requireWard(ctx) { if (!ctx.body.wardCode) throw new Error('缺少当前授权病区编码') }
function keywordOf(value) {
  const keyword = value.trim()
  if (keyword.length > 100) throw new Error('查询内容最多100个字符')
  return keyword
}
function rawCode(code) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('请扫描或输入二维码内容')
  return code
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
  return { ...first, records }
}
export function mapPrescription(raw) {
  return {
    ...raw, id: JSON.stringify([raw.recordId, raw.executionRecordId ?? null, raw.logisticsRecordId ?? null, raw.packageCode ?? null]),
    business: state.business, hospitalId: hospital.id, name: raw.patientName ?? '--', no: raw.prescriptionNo ?? '--',
    registrationNo: raw.registrationNo ?? '--', inpatientNo: raw.inpatientNo ?? '', dose: raw.doseCount ?? '--', way: raw.pickupType ?? '--',
    bed: raw.bedNo ?? '', wardId: raw.wardCode ?? '', wardName: raw.wardName ?? '', route: raw.route ?? '--', frequency: raw.frequency ?? '--',
    batch: raw.executionRecordId ?? '--', split: !!raw.executionRecordId, prescriptionDate: raw.prescriptionDate ?? '--',
    acceptedAt: raw.acceptedAt ?? '', acceptedBy: raw.acceptedByName ?? '--', receivedAt: raw.receivedAt ?? '', ingredients: raw.ingredients ?? []
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
  if (kind === 'accept' && useStaticData) return todayRecords('accept').length
  if (kind === 'receive') return state.todayReceiveCount ?? '--'
  if (kind === 'dispense') return state.todayDispenseCount ?? '--'
  return '--'
}
export function switchBusiness(value) { state.business = value; requestContext() }
export async function loadAcceptance(keyword = '') {
  const ctx = requestContext()
  const data = await fetchPages(api.acceptancePage, { ...ctx.body, ...(keyword ? { keyword: keywordOf(keyword) } : {}) }, ctx)
  const rows = storeRows(data.records)
  if (!keyword) { state.acceptanceRows = rows; state.pendingAcceptanceCount = data.pendingCount ?? data.total ?? rows.length }
  return rows
}
export async function findPackage(code) {
  const rows = await loadAcceptance(rawCode(code))
  if (!rows.length) throw new Error('未找到待验收药包，请检查二维码内容')
  return rows
}
export async function acceptPackage(id, smsReminder = true) {
  const ctx = requestContext()
  const row = state.rows.find(item => item.id === id)
  if (!row?.recordId) throw new Error('缺少接口返回的处方记录ID，请重新加载')
  if (row.canAccept === false) throw new Error(row.acceptanceBlockedReason || '当前药包不可验收')
  const data = await api.acceptanceConfirm({ ...ctx.body, recordId: row.recordId, executionRecordId: row.executionRecordId ?? null, ...(row.logisticsRecordId ? { logisticsRecordId: row.logisticsRecordId } : {}), ...(row.waybillNo ? { waybillNo: row.waybillNo } : {}), ...(useStaticData ? { smsReminder } : {}) }, ctx.session)
  assertCurrent(ctx)
  if (data.accepted !== true) throw responseError(data, '接口未返回验收成功，请重新查询药包状态')
  row.accepted = true
  if (useStaticData) Object.assign(row, mapPrescription(data))
  return data
}
export async function searchDispense(value = '') {
  const ctx = requestContext(); const keyword = keywordOf(value)
  if (ctx.body.mode === '2') requireWard(ctx)
  const searchTypes = ctx.body.mode === '2' ? ['NAME', 'REGISTRATION_NO', 'PRESCRIPTION_NO', 'INPATIENT_NO', 'BED_NO'] : ['NAME', 'REGISTRATION_NO', 'PRESCRIPTION_NO', 'ID_CARD']
  // Preserve the single search box by merging its supported search fields.
  const results = keyword ? await Promise.all(searchTypes.map(searchType => fetchPages(api.dispensePage, { ...ctx.body, keyword, searchType }, ctx))) : [await fetchPages(api.dispensePage, ctx.body, ctx)]
  assertCurrent(ctx)
  const unique = new Map()
  for (const raw of results.flatMap(result => result.records)) unique.set(JSON.stringify([raw.recordId, raw.executionRecordId ?? null]), raw)
  state.dispenseRows = storeRows([...unique.values()])
  return state.dispenseRows
}
export async function findPatient(code) {
  const ctx = requestContext()
  if (ctx.body.mode !== '1') throw new Error('当前页面仅支持门诊双扫码发药')
  const data = await api.visitStart({ ...ctx.body, scanCode: rawCode(code) }, ctx.session)
  assertCurrent(ctx)
  if (!data.scanToken) throw responseError(data, '接口未返回扫码核验凭证，请重新扫描就诊码')
  const candidates = (data.candidates || []).map(raw => mapPrescription({
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
export async function dispensePackage(row, scanToken) {
  const ctx = requestContext()
  if (!row?.recordId) throw new Error('缺少接口返回的处方记录ID，请重新加载')
  if (row.hospitalId !== ctx.body.hospitalCode || row.business !== state.business) throw new Error('业务或医院已切换，请重新扫描药包')
  if (ctx.body.mode === '2') {
    requireWard(ctx)
    if (!row.wardCode || row.wardCode !== ctx.body.wardCode) throw new Error('药包病区与当前病区不一致，禁止发药')
  } else if (!scanToken) throw new Error('请先完成就诊码和处方二维码双扫码核验')
  const data = await api.dispenseConfirm({
    ...ctx.body, recordId: row.recordId, executionRecordId: row.executionRecordId ?? null,
    ...(ctx.body.mode === '1' ? { scanToken } : {})
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
export async function findWardPackage(code) {
  const ctx = requestContext(); requireWard(ctx)
  const data = await api.scanResolve({ ...ctx.body, scanType: 'PACKAGE', scanCode: rawCode(code) }, ctx.session)
  assertCurrent(ctx)
  const candidates = data.candidates || []
  if (!candidates.length) throw responseError(data, data.requiresHISMapping ? '该药包尚未完成HIS映射' : '未找到药包，请检查二维码内容')
  if (candidates.length !== 1) throw responseError(data, '存在多个处方或执行批次，请扫描具体药包二维码')
  const row = mapPrescription(candidates[0])
  if (!row.recordId) throw responseError(data, '扫码接口未返回处方记录ID')
  if (!row.wardCode || row.wardCode !== ctx.body.wardCode) throw responseError(data, '药包病区与当前病区不一致，禁止发药')
  return row
}
export async function receivePackage(packageCode) {
  const ctx = requestContext(); requireWard(ctx)
  const data = await api.wardReceiveConfirm({ ...ctx.body, mode: '2', packageCode: rawCode(packageCode) }, ctx.session)
  assertCurrent(ctx)
  if (data.received !== true && data.alreadyReceived !== true) throw responseError(data, '接口未返回接收成功，请重新查询药包状态')
  return data
}
export async function loadToday(kind = 'dispense') {
  if (kind === 'accept' && !useStaticData) return
  const ctx = requestContext()
  if (ctx.body.mode === '2') requireWard(ctx)
  const receive = kind === 'receive'
  const accept = kind === 'accept'
  const data = await fetchPages(accept ? api.acceptanceToday : receive ? api.wardReceiveToday : api.dispenseToday, { ...ctx.body, ...(receive ? { mode: '2' } : {}) }, ctx)
  const records = data.records.map((raw, index) => ({ ...mapPrescription(raw), kind, entryId: JSON.stringify([kind, raw.recordId, raw.executionRecordId, raw.packageCode, index]), time: (accept ? raw.acceptedAt : receive ? raw.receivedAt : raw.dispensedAt) || '--', operator: (accept ? raw.acceptedByName : receive ? raw.receivedByName : raw.dispensedByName) || '--' }))
  state.records = [...state.records.filter(row => row.kind !== kind), ...records]
  if (accept) return data
  if (receive) { state.todayReceiveCount = data.todayCount ?? data.total ?? records.length; state.receiveStatDate = data.statDate || '' }
  else { state.todayDispenseCount = data.todayCount ?? data.total ?? records.length; state.dispenseStatDate = data.statDate || '' }
  return data
}
export async function refreshOverview() {
  requestContext()
  await refreshRequests([() => loadAcceptance(), () => loadToday('accept'), () => loadToday('dispense'), ...(state.business === 'inpatient' ? [() => loadWardPending()] : [() => searchDispense()])])
}
export async function refreshRequests(tasks) {
  const results = await Promise.allSettled(tasks.map(task => task()))
  const failure = results.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
}
export function toast(message) { uni.showToast({ title: message, icon: 'none', duration: 2200 }) }
export function navigate(path) { uni.navigateTo({ url: `/pages/${path === 'dispense' && state.business === 'inpatient' ? 'ward-receive' : path}/index` }) }
