<template>
  <AppShell title="患者发药" active="dispense" back nursing business-picker fixed-content @business-change="reset" @ward-change="reset" @conflict="refresh">
    <view class="dispense-content">
    <view class="record-toolbar"><view class="range-switch entry-switch"><button :class="{ active: entry === 'scan' }" :disabled="submitting" @click="changeEntry('scan')">扫码发药</button><button :class="{ active: entry === 'manual' }" :disabled="submitting" @click="changeEntry('manual')">批量发药</button></view></view>
    <template v-if="entry === 'scan'">
    <ScanPanel :title="state.business === 'outpatient' ? '扫描患者就诊码' : '扫描患者腕带'" :subtitle="state.business === 'outpatient' ? '门诊患者身份核对' : '住院患者身份核对'" @scan="scanPatient" />
    <view class="input-action"><view class="search-field"><AppIcon name="user-round" :size="18" /><input v-model="patientCode" placeholder="输入就诊码原文" confirm-type="search" @confirm="identify" /></view><button class="secondary-button compact" @click="identify">识别</button></view>
    <view v-if="patient" class="identified-patient"><AppIcon name="shield-check" :size="21" /><view class="grow"><text class="row-title">{{ patient.name }}<text class="small"> 已识别</text></text><text class="row-subtitle">登记号 {{ patient.registrationNo }}</text></view><button class="icon-button" aria-label="清除患者" @click="clearPatient"><AppIcon name="x" :size="17" /></button></view>
    </template>
    <view class="section-heading"><text>待发药处方</text><text class="section-meta">{{ shown.length }} 条</text></view>
    <view class="input-action"><view class="search-field"><AppIcon name="search" :size="18" /><input v-model="draft" placeholder="患者姓名" confirm-type="search" @confirm="search" /><button v-if="draft" class="icon-button small-icon" aria-label="清空搜索" @click="clearSearch"><AppIcon name="x" :size="15" /></button></view><button class="primary-button compact" @click="search">搜索</button></view>
    <view v-if="patient" class="filter-line"><text class="filter-chip green-chip">{{ patient.name }}的待发药处方</text></view>
    <PackageSelection v-if="entry === 'manual' && shown.length" v-model="checkedIds" compact-details scrollable :rows="shown" :selectable="canSelect" :blocked-reason="blockedReason" :disabled="submitting" action-label="确认发药" @confirm="confirmSelected" />
    <scroll-view v-if="entry === 'scan' && shown.length" scroll-y class="prescription-scroll"><PrescriptionCard v-for="row in shown" :key="`${row.id}:${detailsRevision}`" :row="row" :default-expanded="!!patient || !!keyword"><button class="secondary-button card-action" @click="open(row)">核对药包<AppIcon name="chevron-right" :size="17" /></button></PrescriptionCard></scroll-view>
    <EmptyState v-if="!shown.length" icon-only title="暂无待发药处方" />
    <button class="record-link" @click="navigate('dispense-records')"><AppIcon name="file-check-2" :size="20" /><text class="grow">今日已发药</text><text class="strong">{{ todayCount('dispense') }} 条</text><AppIcon name="chevron-right" :size="18" /></button>
    </view>
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
import PackageSelection from '../../components/PackageSelection.vue'
import { state, hospital, operator, searchDispense, findPatient, verifyPrescription, mapPrescription, dispensePackage, loadToday, todayCount, refreshRequests, navigate, toast } from '../../domain/pharmacy'
import { scanCode } from '../../services/scanner'
import { responseError } from '../../services/prescription'
const draft = ref(''); const keyword = ref(''); const patientCode = ref(''); const patient = ref(null)
const selected = ref(null); const packageCode = ref(''); const verified = ref(false); const submitting = ref(false)
let visitExpiresAt = 0; let verifiedExpiresAt = 0
const loading = ref(false); const checking = ref(false); const rows = ref([])
const detailsRevision = ref(0)
const entry = ref('scan'); const checkedIds = ref([]); const batchErrors = ref({})
function blockedReason(row) {
  if (row.status === 'dispensed' || row.dispensedAt) return '该处方已发药'
  return ''
}
const canSelect = row => !blockedReason(row)
function changeEntry(value) {
  if (submitting.value || checking.value || loading.value) return
  clearPatient(); entry.value = value; checkedIds.value = []; batchErrors.value = {}
}
let revision = 0; let queryRevision = 0
onShow(() => {
  if (state.business === 'inpatient') return
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
    detailsRevision.value++
    if (patient.value) patient.value.candidates = patient.value.candidates.map(candidate => ({
      ...result.find(row => row.recordId === candidate.recordId && (row.executionRecordId ?? null) === (candidate.executionRecordId ?? null)), ...candidate
    }))
  }
}
async function refresh() { try { await refreshRequests([loadRows, () => loadToday('dispense')]) } catch (error) { toast(error.message) } }
async function search() { keyword.value = draft.value.trim(); try { await loadRows() } catch (error) { toast(error.message) } }
function clearSearch() { draft.value = ''; keyword.value = ''; refresh() }
function clearPatient() { revision++; patient.value = null; patientCode.value = ''; selected.value = null; packageCode.value = ''; verified.value = false; visitExpiresAt = 0; verifiedExpiresAt = 0 }
function reset() { clearPatient(); close(); rows.value = []; checkedIds.value = []; batchErrors.value = {}; clearSearch() }
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
    patient.value = result; detailsRevision.value++; visitExpiresAt = Date.now() + 300000; patientCode.value = code; draft.value = ''; keyword.value = ''; toast('患者身份已识别，请扫描处方二维码')
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
    if (Date.now() >= visitExpiresAt) throw new Error('扫码凭证已过期，请重新扫描就诊码')
    const result = await verifyPrescription(patient.value.scanToken, originalCode)
    if (request !== revision || packageCode.value !== originalCode) return
    if (result.recordId !== selected.value.recordId || (selected.value.executionRecordId != null && result.executionRecordId !== selected.value.executionRecordId)) throw responseError(result, '扫描处方与所选处方或执行批次不一致，请重新扫描就诊码')
    selected.value = mapPrescription({ ...selected.value, ...result })
    patient.value.scanToken = result.scanToken || patient.value.scanToken
    verifiedExpiresAt = Date.now() + 60000; visitExpiresAt = verifiedExpiresAt
    verified.value = true; toast('患者登记号及处方核对一致')
  } catch (error) { if (request === revision) { clearPatient(); close() }; toast(error.message) } finally { checking.value = false }
}
async function confirm() {
  if (!verified.value || submitting.value || checking.value || !selected.value) return
  if (Date.now() >= verifiedExpiresAt) { clearPatient(); toast('扫码凭证已过期，请重新扫描就诊码'); return }
  submitting.value = true
  try {
    const result = await dispensePackage(selected.value, patient.value?.scanToken)
    submitting.value = false; clearPatient(); close(); draft.value = ''; keyword.value = ''
    toast(result.alreadyDispensed ? '该处方此前已发药' : '发药成功'); await refresh()
  } catch (error) { submitting.value = false; clearPatient(); close(); toast(error.message) } finally { submitting.value = false }
}
async function confirmSelected(selectedRows) {
  if (submitting.value || !selectedRows.length) return
  submitting.value = true; batchErrors.value = {}
  const context = state.contextKey; let success = 0; let failed = 0
  try {
    for (const row of selectedRows) {
      if (state.contextKey !== context) break
      try {
        await dispensePackage(row, undefined, { manual: true })
        row.status = 'dispensed'; success++
        rows.value = rows.value.filter(item => item.id !== row.id)
        checkedIds.value = checkedIds.value.filter(id => id !== row.id)
      } catch (error) { failed++; batchErrors.value[row.id] = error.message }
    }
    if (state.contextKey === context) { toast(failed ? Object.values(batchErrors.value)[0] : `发药成功 ${success} 个`); await refresh() }
  } finally { submitting.value = false }
}
</script>
<style scoped>
.dispense-content { display: flex; flex: 1; flex-direction: column; min-height: 0; padding: 20px var(--gutter) 0; overflow: hidden; }
.dispense-content > :not(.package-selection):not(.prescription-scroll):not(.empty-state) { flex-shrink: 0; }
.dispense-content .section-heading { margin-top: 10px; }
.prescription-scroll { flex: 1; height: 0; min-height: 0; }
.dispense-content .empty-state { flex: 1; min-height: 0; }
.app-shell .dispense-content .record-link { margin-top: 12px; }
</style>
