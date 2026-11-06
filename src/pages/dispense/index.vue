<template>
  <AppShell title="患者发药" active="dispense" back nursing @business-change="reset">
    <view class="workflow-steps"><view :class="{ done: patient }"><text class="step-number">1</text>患者识别</view><view class="step-line" /><view :class="{ done: verified }"><text class="step-number">2</text>药包核对</view><view class="step-line" /><view><text class="step-number">3</text>确认发药</view></view>
    <ScanPanel :title="state.business === 'outpatient' ? '扫描患者就诊码' : '扫描患者腕带'" :subtitle="state.business === 'outpatient' ? '门诊患者身份核对' : '住院患者身份核对'" @scan="scanPatient" />
    <view class="input-action"><view class="search-field"><AppIcon name="user-round" :size="18" /><input v-model="patientCode" :placeholder="state.business === 'outpatient' ? '输入就诊号，如 JZ-1007' : '输入住院号，如 ZY-1013'" confirm-type="search" @confirm="identify" /></view><button class="secondary-button compact" @click="identify">识别</button></view>
    <view v-if="patient" class="identified-patient"><AppIcon name="shield-check" :size="21" /><view class="grow"><text class="row-title">{{ patient.name }}<text class="small"> 已识别</text></text><text class="row-subtitle">登记号 {{ patient.registrationNo }}</text></view><button class="icon-button" aria-label="清除患者" @click="clearPatient"><AppIcon name="x" :size="17" /></button></view>
    <view class="section-heading"><text>待发药处方</text><text class="section-meta">{{ shown.length }} 条</text></view>
    <view class="input-action"><view class="search-field"><AppIcon name="search" :size="18" /><input v-model="draft" placeholder="姓名 / 登记号 / 处方号 / 住院号 / 床号" confirm-type="search" @confirm="search" /><button v-if="draft" class="icon-button small-icon" aria-label="清空搜索" @click="clearSearch"><AppIcon name="x" :size="15" /></button></view><button class="primary-button compact" @click="search">搜索</button></view>
    <view class="filter-line"><text class="filter-chip">{{ keyword ? '全部日期' : '最近两天' }}</text><text class="filter-chip">配送自取</text><text class="filter-chip">代煎自取</text><text v-if="patient" class="filter-chip green-chip">当前患者</text></view>
    <PrescriptionCard v-for="row in shown" :key="row.id" :row="row"><button class="secondary-button card-action" @click="open(row)">核对药包<AppIcon name="chevron-right" :size="17" /></button></PrescriptionCard>
    <EmptyState v-if="!shown.length" icon="pill" title="暂无匹配的待发药处方" :subtitle="keyword ? '可更换编号或业务类型查询' : '当前条件下无待发药药包'" />
    <button class="record-link" @click="navigate('dispense-records')"><AppIcon name="file-check-2" :size="20" /><text class="grow">今日已发药</text><text class="strong">{{ todayCount('dispense') }} 条</text><AppIcon name="chevron-right" :size="18" /></button>
    <view v-if="selected" class="modal-mask" @click="close"><view class="confirmation-sheet" @click.stop><view class="sheet-heading"><text>核对并确认发药</text><button class="icon-button" aria-label="关闭" @click="close"><AppIcon name="x" :size="21" /></button></view><scroll-view scroll-y class="sheet-scroll"><view class="sheet-patient"><text>{{ selected.name }}</text><text class="way-tag">{{ selected.way }}</text><text v-if="selected.bed" class="small muted">{{ selected.bed }} 床</text></view><view class="confirmation-rows"><view><text>处方号</text><text>{{ selected.no }}</text></view><view><text>登记号</text><text>{{ selected.registrationNo }}</text></view><view><text>执行批次</text><text>{{ selected.batch }}{{ selected.split ? '（拆分处方）' : '（普通处方）' }}</text></view><view><text>剂数 / 用法</text><text>{{ selected.dose }} 剂 · {{ selected.route }} · {{ selected.frequency }}</text></view><view><text>验收时间</text><text>{{ selected.acceptedAt }}</text></view><view><text>操作人</text><text>{{ operator.name }} · {{ hospital.name }}</text></view></view><view v-if="!patient" class="warning-inline">尚未识别患者，请先扫描就诊码或腕带</view><view class="package-input-label">药包二维码</view><view class="input-action"><view class="search-field"><input v-model="packageCode" placeholder="扫描或输入本次药包码" @input="verified = false" confirm-type="done" @confirm="verify" /></view><button class="icon-button scan-small" aria-label="扫描药包" @click="scanPackage"><AppIcon name="scan-line" :size="24" /></button></view><button class="secondary-button verify-button" @click="verify"><AppIcon :name="verified ? 'shield-check' : 'scan-line'" :size="18" />{{ verified ? '患者与药包核对一致' : '核对药包' }}</button><view class="sheet-tip">{{ state.business === 'inpatient' ? '发药前须完成病区药包接收' : '登记号一致且药包核对通过后可发药' }}</view></scroll-view><view class="sheet-actions"><button class="secondary-button" @click="close">取消</button><button class="primary-button" :disabled="!verified || submitting" @click="confirm">{{ submitting ? '提交中' : '确认发药' }}</button></view></view></view>
  </AppShell>
</template>
<script setup>
import { ref, computed } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import ScanPanel from '../../components/ScanPanel.vue'
import EmptyState from '../../components/EmptyState.vue'
import PrescriptionCard from '../../components/PrescriptionCard.vue'
import { state, hospital, operator, searchDispense, findPatient, verifyPrescription, mapPrescription, dispensePackage, loadToday, todayCount, refreshRequests, navigate, toast } from '../../domain/pharmacy'
import { scanCode } from '../../services/scanner'
const draft = ref(''); const keyword = ref(''); const patientCode = ref(''); const patient = ref(null)
const selected = ref(null); const packageCode = ref(''); const verified = ref(false); const submitting = ref(false)
const loading = ref(false); const checking = ref(false); const rows = ref([])
let revision = 0; let queryRevision = 0
onShow(() => {
  if (state.business === 'inpatient') { uni.reLaunch({ url: '/pages/ward-receive/index' }); return }
  refresh()
})
onHide(() => { clearPatient(); close() })
onUnload(() => { clearPatient(); close() })
const shown = computed(() => {
  if (!patient.value) return rows.value
  if (!keyword.value) return patient.value.candidates
  return rows.value.filter(row => patient.value.candidates.some(candidate => candidate.recordId === row.recordId))
})
async function loadRows() {
  const request = ++queryRevision
  const result = await searchDispense(keyword.value)
  if (request === queryRevision) {
    rows.value = result
    if (patient.value) patient.value.candidates = patient.value.candidates.map(candidate => ({
      ...result.find(row => row.recordId === candidate.recordId && (row.executionRecordId ?? null) === (candidate.executionRecordId ?? null)), ...candidate
    }))
  }
}
async function refresh() { try { await refreshRequests([loadRows, () => loadToday('dispense')]) } catch (error) { toast(error.message) } }
async function search() { keyword.value = draft.value.trim(); try { await loadRows() } catch (error) { toast(error.message) } }
function clearSearch() { draft.value = ''; keyword.value = ''; refresh() }
function clearPatient() { revision++; patient.value = null; patientCode.value = ''; selected.value = null; packageCode.value = ''; verified.value = false }
function reset() { clearPatient(); close(); rows.value = []; clearSearch() }
async function identify() {
  if (loading.value || checking.value || submitting.value) return
  const code = patientCode.value
  clearPatient(); close(); const request = revision; loading.value = true
  try {
    const result = await findPatient(code)
    if (request !== revision) return
    result.candidates = result.candidates.map(candidate => ({
      ...rows.value.find(row => row.recordId === candidate.recordId && (row.executionRecordId ?? null) === (candidate.executionRecordId ?? null)), ...candidate
    }))
    patient.value = result; patientCode.value = code; draft.value = ''; keyword.value = ''; toast('患者身份已识别，请扫描处方二维码')
  } catch (error) { toast(error.message) } finally { loading.value = false }
}
async function scanPatient() { try { patientCode.value = await scanCode({ type: 'patient', business: state.business }); await identify() } catch (error) { toast(error.message) } }
function open(row) {
  if (submitting.value || checking.value) return
  if (!patient.value) { toast('请先扫描或输入就诊号识别患者'); return }
  selected.value = row; packageCode.value = ''; verified.value = false
}
function close() { if (submitting.value) return; revision++; selected.value = null; packageCode.value = ''; verified.value = false }
async function scanPackage() { try { packageCode.value = await scanCode({ type: 'package', business: state.business, recordId: selected.value?.recordId, executionRecordId: selected.value?.executionRecordId }); await verify() } catch (error) { toast(error.message) } }
async function verify() {
  if (checking.value || submitting.value) return
  verified.value = false
  const request = revision; const originalCode = packageCode.value; checking.value = true
  try {
    if (!patient.value?.scanToken || !selected.value) throw new Error('请先识别患者并选择处方')
    const result = await verifyPrescription(patient.value.scanToken, originalCode)
    if (request !== revision || packageCode.value !== originalCode) return
    if (result.recordId !== selected.value.recordId || (selected.value.executionRecordId != null && result.executionRecordId !== selected.value.executionRecordId)) throw new Error('扫描处方与所选处方或执行批次不一致，请重新扫描就诊码')
    selected.value = mapPrescription({ ...selected.value, ...result })
    patient.value.scanToken = result.scanToken || patient.value.scanToken
    verified.value = true; toast('患者登记号及处方核对一致')
  } catch (error) { if (request === revision) { clearPatient(); close() }; toast(error.message) } finally { checking.value = false }
}
async function confirm() {
  if (!verified.value || submitting.value || checking.value || !selected.value) return
  submitting.value = true
  try {
    await dispensePackage(selected.value, patient.value?.scanToken)
    submitting.value = false; clearPatient(); close(); draft.value = ''; keyword.value = ''
    toast('发药成功'); await refresh()
  } catch (error) { submitting.value = false; clearPatient(); close(); toast(error.message) } finally { submitting.value = false }
}
</script>
