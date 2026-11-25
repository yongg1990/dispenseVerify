<template>
  <AppShell title="整单验收" active="waybill-accept" back business-picker @business-change="reset" @ward-change="reset">
    <ScanPanel title="扫描运单条码" subtitle="整单到货 · 药包验收" @scan="scan" />
    <view class="input-action"><view class="search-field"><AppIcon name="package" :size="19" /><input v-model="waybillNo" :disabled="busy" placeholder="输入运单号" confirm-type="search" @input="clearResult" @confirm="query" /></view><button class="primary-button compact" :disabled="busy" @click="query">查询</button></view>
    <view class="search-field"><input v-model="companyCode" :disabled="busy" placeholder="物流公司编码（选填）" @input="clearResult" /></view>
    <template v-if="result">
      <view class="overview-band waybill-overview"><text class="overview-label">运单 {{ result.waybillNo }}</text><view class="waybill-counts"><view><text>{{ result.prescriptionCount ?? '--' }}</text><text>处方</text></view><view><text>{{ result.itemCount ?? rows.length }}</text><text>药包</text></view><view><text>{{ result.acceptedCount ?? '--' }}</text><text>已验收</text></view><view><text>{{ result.pendingCount ?? '--' }}</text><text>待验收</text></view></view></view>
      <button class="primary-button card-action" :disabled="busy || !pending.length" @click="confirmAll"><AppIcon name="check" :size="18" />整单验收</button>
      <view class="section-heading"><text>运单药包</text><text class="section-meta">{{ rows.length }} 个</text></view>
      <PackageSelection v-if="rows.length" v-model="checkedIds" :rows="rows" :disabled="busy" :selectable="selectable" :blocked-reason="blockedReason" action-label="验收所选处方" confirmation-message="确认验收所选处方在本运单下的全部药包？同一处方的多个批次会一并验收。" @confirm="confirmSelected" />
      <EmptyState v-else icon-only title="该运单暂无药包" />
    </template>
    <EmptyState v-else title="请扫描或输入运单号" />
  </AppShell>
</template>
<script setup>
import { computed, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import ScanPanel from '../../components/ScanPanel.vue'
import PackageSelection from '../../components/PackageSelection.vue'
import EmptyState from '../../components/EmptyState.vue'
import { requestContext, mapPrescription, hasRecordData, toast, operator } from '../../domain/pharmacy'
import { prescriptionApi } from '../../services/prescription'
import { scanCode } from '../../services/scanner'
const waybillNo = ref(''); const companyCode = ref(''); const result = ref(null); const busy = ref(false); const checkedIds = ref([])
let resultKey = ''
const rows = computed(() => (result.value?.records || []).filter(hasRecordData).map(raw => mapPrescription({ ...raw, status: raw.prescriptionStatus })))
const selectable = row => !row.accepted && row.acceptanceStatus !== 'ACCEPTED'
const blockedReason = row => selectable(row) ? '' : '已验收'
const pending = computed(() => rows.value.filter(selectable))
function clearResult() { result.value = null; checkedIds.value = []; resultKey = '' }
function reset() { clearResult(); waybillNo.value = ''; companyCode.value = '' }
function body(ctx) {
  return { hospitalCode: ctx.body.hospitalCode || undefined, waybillNo: waybillNo.value.trim(), ...(companyCode.value.trim() ? { logisticsCompanyCode: companyCode.value.trim() } : {}) }
}
async function query() {
  if (busy.value) return
  if (!waybillNo.value.trim()) { toast('请扫描或输入运单号'); return }
  clearResult(); busy.value = true
  const ctx = requestContext(); const input = body(ctx)
  try {
    const data = await prescriptionApi.hospitalAcceptanceQuery(input, ctx.session)
    if (requestContext().key !== ctx.key || input.waybillNo !== waybillNo.value.trim() || (input.logisticsCompanyCode || '') !== companyCode.value.trim()) return
    result.value = data; resultKey = ctx.key
  } catch (error) { toast(error.message) } finally { busy.value = false }
}
async function scan() { if (busy.value) return; try { waybillNo.value = await scanCode(); await query() } catch (error) { toast(error.message) } }
function confirmAll() {
  if (busy.value || !pending.value.length) return
  uni.showModal({ title: '整单验收', content: `确认验收运单 ${result.value.waybillNo} 的全部待验收药包？`, success: answer => { if (answer.confirm) submit('ALL') } })
}
function confirmSelected(selected) { submit('SELECTED', selected) }
async function submit(mode, selected = []) {
  if (busy.value || !result.value) return
  const ctx = requestContext()
  if (ctx.key !== resultKey || result.value.waybillNo !== waybillNo.value.trim()) { clearResult(); toast('登录、业务或运单已切换，请重新查询'); return }
  if (mode === 'SELECTED' && !selected.length) return
  const request = { ...body(ctx), mode, ...(mode === 'SELECTED' ? { recordIds: [...new Set(selected.map(row => row.recordId))] } : {}) }
  busy.value = true
  try {
    const data = await prescriptionApi.hospitalAcceptanceConfirm(request, ctx.session)
    if (requestContext().key !== ctx.key) return
    result.value = data; checkedIds.value = []
    toast(`本次验收 ${data.confirmedCount ?? 0} 个，已验收 ${data.alreadyAcceptedCount ?? 0} 个`)
  } catch (error) {
    toast(error.message)
    if (error.code === 6109) { busy.value = false; await query() }
  } finally { busy.value = false }
}
</script>
<style scoped>
.waybill-overview { margin-top: 24px; }
.overview-label { display: block; overflow-wrap: anywhere; }
.waybill-counts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 18px; }
.waybill-counts > view { display: flex; flex-direction: column; gap: 5px; padding-left: 12px; border-left: 1px solid var(--line); }
.waybill-counts > view:first-child { padding-left: 0; border-left: 0; }
.waybill-counts > view > text:first-child { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.waybill-counts > view > text:last-child { color: var(--muted); font-size: 12px; }
</style>
