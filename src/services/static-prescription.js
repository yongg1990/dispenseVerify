export const staticSession = {
  hospitalCode: 'HOSP-001', hospitalName: '市中医院',
  wardCode: 'WARD-003', wardName: '三病区',
  operatorId: 'OP-001', operatorName: '张药师', department: '中药房'
}

const pad = value => String(value).padStart(2, '0')
function dateText() {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const at = time => `${dateText()} ${time}`
const ingredients = [
  { name: '黄芪', grams: 20 }, { name: '党参', grams: 15 },
  { name: '白术', grams: 12 }, { name: '茯苓', grams: 15 },
  { name: '当归', grams: 10 }, { name: '炙甘草', grams: 6 }
]
const rows = [
  createRow('M1', '1', '王晓华', '1001', 'packed'),
  createRow('M2', '1', '赵明', '1002', 'accepted'),
  createRow('M3', '1', '李静', '1003', 'dispensed'),
  createRow('M4', '1', '夏芳', '1004', 'accepted'),
  createRow('M5', '1', '周建国', '1005', 'dispensed'),
  createRow('M6', '1', '林秀兰', '1006', 'packed'),
  createRow('M7', '1', '陈怡', '1007', 'accepted', '01'),
  createRow('M7', '1', '陈怡', '1007', 'packed', '02'),
  createRow('Z1', '2', '张桂英', '1008', 'accepted'),
  createRow('Z2', '2', '吴志强', '1009', 'dispensed'),
  createRow('Z3', '2', '何丽', '1010', 'packed'),
  createRow('Z4', '2', '杨建华', '1011', 'dispensed'),
  createRow('Z6', '2', '孙梅', '1012', 'packed'),
  createRow('Z7', '2', '刘芳', '1013', 'accepted')
]
const tokens = new Map()
let tokenId = 0

export function staticScanOptions({ type = 'accept', business = 'outpatient', recordId, executionRecordId } = {}) {
  const mode = business === 'inpatient' ? '2' : '1'
  const candidates = rows.filter(row => row.mode === mode && (type === 'accept' ? !row.accepted : row.accepted && !row.dispensedAt))
    .filter(row => !recordId || (row.recordId === recordId && (row.executionRecordId ?? null) === (executionRecordId ?? null)))
  const options = candidates.map(row => ({
    code: type === 'patient' ? row.visitNo : row.packageCode,
    name: row.patientName
  }))
  return [...new Map(options.map(option => [option.code, option])).values()].slice(0, 6)
}

function createRow(id, mode, name, patientNo, status, batch = null) {
  const accepted = status !== 'packed'
  const inpatient = mode === '2'
  return {
    recordId: `REC-${id}`, executionRecordId: batch ? `${id}-${batch}` : null,
    logisticsRecordId: `LOG-${id}-${batch || '01'}`, packageCode: `PKG-${id}-${batch || '01'}`,
    waybillNo: `WB-${id}-${batch || '01'}`, mode,
    patientName: name, registrationNo: `DJ-${4100 + Number(patientNo) - 1001}`,
    patientGender: ['M2', 'M5', 'Z2', 'Z4'].includes(id) ? '男' : '女', patientAge: 30 + Number(patientNo) % 40,
    visitNo: `JZ-${patientNo}`, inpatientNo: inpatient ? `ZY-${patientNo}` : '',
    idCard: `11010119900101${patientNo}`, prescriptionNo: `CF-${inpatient ? 'ZY' : 'MZ'}-${patientNo}`,
    doseCount: batch ? 7 : 14, pickupType: inpatient ? '代煎配送' : Number(patientNo) % 2 ? '代煎自取' : '配送自取',
    wardCode: inpatient ? staticSession.wardCode : '', wardName: inpatient ? staticSession.wardName : '',
    bedNo: inpatient ? String(Number(patientNo) - 1000).padStart(2, '0') : '',
    route: '口服', frequency: '每日两次', prescriptionDate: at('08:00:00'), ingredients,
    status, accepted, canAccept: !accepted, acceptedAt: accepted ? at('08:30:00') : '',
    acceptedByName: accepted ? '张药师' : '', receivedAt: status === 'dispensed' && inpatient ? at('09:00:00') : '',
    receivedByName: status === 'dispensed' && inpatient ? '李护士' : '',
    dispensedAt: status === 'dispensed' ? at(`09:${Number(patientNo) % 2 ? '25' : '10'}:00`) : '',
    dispensedByName: status === 'dispensed' ? inpatient ? '李护士' : '张药师' : ''
  }
}
function matches(row, keyword, fields) {
  const value = String(keyword || '').trim().toLowerCase()
  return !value || fields.some(key => String(row[key] || '').toLowerCase().includes(value))
}
function page(records, body) {
  const start = ((body.pageNum || 1) - 1) * (body.pageSize || 100)
  return {
    records: records.slice(start, start + (body.pageSize || 100)).map(row => ({ ...row })),
    total: records.length, pages: Math.ceil(records.length / (body.pageSize || 100)),
    pendingCount: records.length, todayCount: records.length, statDate: dateText()
  }
}
function findRow(body) {
  const row = rows.find(item => item.mode === body.mode && item.recordId === body.recordId && (item.executionRecordId ?? null) === (body.executionRecordId ?? null))
  if (!row) throw new Error('未找到对应处方或执行批次')
  return row
}
function resolveCode(list, code) {
  const value = String(code || '').trim().toLowerCase()
  return list.filter(row => ['packageCode', 'prescriptionNo', 'visitNo', 'registrationNo', 'inpatientNo'].some(key => String(row[key] || '').toLowerCase() === value))
}

export async function staticPrescription(path, body) {
  const list = rows.filter(row => row.mode === body.mode)
  const searchable = ['patientName', 'registrationNo', 'prescriptionNo', 'inpatientNo', 'bedNo', 'packageCode']
  switch (path) {
    case '/pharmacy/acceptance/page':
      return page(list.filter(row => (!row.accepted || !!body.keyword) && matches(row, body.keyword, searchable)), body)
    case '/pharmacy/acceptance/confirm': {
      const row = findRow(body)
      Object.assign(row, { accepted: true, canAccept: false, status: 'accepted', acceptedAt: at(new Date().toTimeString().slice(0, 8)), acceptedByName: staticSession.operatorName, smsSent: body.smsReminder === true })
      return { ...row }
    }
    case '/pharmacy/acceptance/today':
      return page(list.filter(row => row.accepted), body)
    case '/pharmacy/dispense/page': {
      const searchFields = { NAME: 'patientName', REGISTRATION_NO: 'registrationNo', PRESCRIPTION_NO: 'prescriptionNo', ID_CARD: 'idCard', INPATIENT_NO: 'inpatientNo', BED_NO: 'bedNo' }
      return page(list.filter(row => row.accepted && !row.dispensedAt && matches(row, body.keyword, body.searchType ? [searchFields[body.searchType]] : searchable)), body)
    }
    case '/pharmacy/outpatient/visit/start': {
      const candidates = resolveCode(list, body.scanCode).filter(row => row.accepted && !row.dispensedAt)
      if (!candidates.length) throw new Error('未找到该患者的待发药处方')
      const scanToken = `STATIC-${++tokenId}`
      tokens.set(scanToken, { registrationNo: candidates[0].registrationNo, verified: null })
      return { scanToken, patientName: candidates[0].patientName, registrationNo: candidates[0].registrationNo, candidates: candidates.map(row => ({ ...row })) }
    }
    case '/pharmacy/outpatient/prescription/verify': {
      const token = tokens.get(body.scanToken)
      if (!token) throw new Error('请重新识别患者')
      const candidates = resolveCode(list.filter(row => row.accepted && !row.dispensedAt && row.registrationNo === token.registrationNo), body.scanCode)
      if (candidates.length !== 1) throw new Error('请扫描或输入具体药包码核对处方与执行批次')
      token.verified = candidates[0]
      return { ...candidates[0], verified: true, scanToken: body.scanToken }
    }
    case '/pharmacy/dispense/confirm': {
      const row = findRow(body)
      if (row.dispensedAt) return { ...row, alreadyDispensed: true }
      if (!row.accepted) throw new Error('药包尚未验收')
      if (body.mode === '1' && body.manual !== true && tokens.get(body.scanToken)?.verified !== row) throw new Error('请先完成患者与药包核对')
      if (body.mode === '2' && row.wardCode !== body.wardCode) throw new Error('药包病区与当前病区不一致')
      Object.assign(row, { status: 'dispensed', dispensedAt: at(new Date().toTimeString().slice(0, 8)), dispensedByName: staticSession.operatorName })
      if (body.scanToken) tokens.delete(body.scanToken)
      return { ...row, dispensed: true }
    }
    case '/pharmacy/dispense/today':
      return page(list.filter(row => row.dispensedAt), body)
    case '/pharmacy/ward-receive/page':
      return page(list.filter(row => row.accepted && !row.dispensedAt && !row.receivedAt && matches(row, body.keyword, searchable)), body)
    case '/pharmacy/scan/resolve':
      return { candidates: resolveCode(list, body.scanCode).map(row => ({ ...row })) }
    case '/pharmacy/ward-receive/confirm': {
      const row = list.find(item => item.packageCode === body.packageCode)
      if (!row || !row.accepted) throw new Error('未找到已验收药包')
      if (row.receivedAt) return { ...row, alreadyReceived: true }
      Object.assign(row, { receivedAt: at(new Date().toTimeString().slice(0, 8)), receivedByName: '李护士' })
      return { ...row, received: true }
    }
    case '/pharmacy/ward-receive/today':
      return page(list.filter(row => row.receivedAt), body)
    default:
      throw new Error('暂无对应静态数据')
  }
}
