<template>
  <AppShell title="病区接收" active="ward-receive" back nursing business-picker fixed-content @business-change="reset" @ward-change="reset" @conflict="refresh">
    <view v-if="state.business === 'inpatient'" class="receive-content">
      <view class="record-toolbar"><view class="range-switch entry-switch"><button :class="{ active: entry === 'scan' }" :disabled="submitting" @click="entry = 'scan'">扫码接收</button><button :class="{ active: entry === 'manual' }" :disabled="submitting" @click="entry = 'manual'">批量接收</button></view></view>
      <template v-if="entry === 'scan'">
      <ScanPanel title="扫描药包二维码" subtitle="住院药包 · 病区接收" @scan="scan" />
      <view class="input-action"><view class="search-field"><AppIcon name="scan-line" :size="18" /><input v-model="code" placeholder="输入药包二维码" confirm-type="search" @confirm="lookup" /></view><button class="primary-button compact" @click="lookup">查询</button></view>
      <view v-if="selected" class="selected-package">
        <scroll-view scroll-y class="selected-scroll"><PrescriptionCard :row="selected" default-expanded><view class="success-inline"><AppIcon name="shield-check" :size="17" />{{ selected.wardName || currentWard.name }} · 病区核验一致</view></PrescriptionCard></scroll-view>
        <button class="primary-button selected-confirm" :disabled="selected.received || submitting" @click="confirm">{{ selected.received ? '已接收' : submitting ? '提交中' : '确认接收' }}</button>
      </view>
      </template>
      <view class="section-heading"><text>待接收药包</text><text class="section-meta">{{ pending.length }} 个</text></view>
      <PackageSelection v-if="entry === 'manual' && pending.length" v-model="checkedIds" compact-details scrollable :rows="pending" :selectable="canSelect" :blocked-reason="blockedReason" :disabled="submitting" action-label="确认接收" @confirm="confirmSelected" />
      <scroll-view v-if="entry === 'scan' && pending.length" scroll-y class="pending-scroll"><view class="compact-record" v-for="row in pending" :key="row.id"><view class="activity-icon teal"><AppIcon name="package" :size="18" /></view><view class="grow"><text class="row-title">{{ row.name }} · {{ row.bed }} 床</text><text class="row-subtitle">{{ row.packageCode }}</text></view><text class="small muted">待扫码</text></view></scroll-view>
      <EmptyState v-if="!pending.length" icon-only title="暂无待接收药包" />
      <view class="received-history">
        <view class="section-heading"><text>今日病区接收</text><text class="section-meta">{{ todayCount('receive') }} 条</text></view>
        <scroll-view scroll-y class="received-scroll">
          <view class="compact-record" v-for="r in received" :key="r.entryId"><view class="grow"><PatientSummary :row="r" prescription-header /><text class="row-subtitle">{{ r.operator }} · {{ r.time }}</text></view><text class="way-tag">已接收</text></view>
          <EmptyState v-if="!received.length" icon-only title="暂无接收记录" />
        </scroll-view>
      </view>
      <button class="record-link" @click="navigate('receive-records')"><AppIcon name="clipboard-list" :size="20" /><text class="grow">接收明细</text><AppIcon name="chevron-right" :size="18" /></button>
    </view>
    <EmptyState v-else icon="bed-double" title="病区接收仅适用于住院业务" subtitle="请选择顶部住院业务" />
  </AppShell>
</template>
<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import ScanPanel from '../../components/ScanPanel.vue'
import PrescriptionCard from '../../components/PrescriptionCard.vue'
import PatientSummary from '../../components/PatientSummary.vue'
import PackageSelection from '../../components/PackageSelection.vue'
import EmptyState from '../../components/EmptyState.vue'
import { state, operator, currentWard, loadWardPending, findWardPackage, receivePackage, loadToday, refreshRequests, todayRecords, todayCount, navigate, toast, matchesCurrentWard } from '../../domain/pharmacy'
import { scanCode } from '../../services/scanner'
const code = ref(''); const selected = ref(null); const submitting = ref(false); const loading = ref(false)
const entry = ref('scan'); const checkedIds = ref([]); const batchErrors = ref({})
const pending = computed(() => state.wardRows.filter(row => !row.received && !row.receivedAt))
function blockedReason(row) {
  if (!matchesCurrentWard(row)) return '药包病区与当前病区不一致，禁止接收'
  if (!row.recordId) return '缺少处方记录ID'
  if (row.received || row.receivedAt) return '该药包已接收'
  return ''
}
const canSelect = row => !blockedReason(row)
const received = computed(() => todayRecords('receive'))
onShow(() => refresh())
async function refresh() {
  if (state.business !== 'inpatient') return
  try { await refreshRequests([() => loadWardPending(), () => loadToday('receive')]) } catch (error) { toast(error.message) }
}
function reset() { code.value = ''; selected.value = null; checkedIds.value = []; batchErrors.value = {}; refresh() }
async function lookup() {
  if (loading.value || submitting.value) return
  selected.value = null; loading.value = true
  try { selected.value = await findWardPackage(code.value, 'receive'); code.value = '' } catch (error) { toast(error.message) } finally { loading.value = false }
}
async function scan() { try { code.value = await scanCode({ type: 'package', business: state.business }); await lookup() } catch (error) { toast(error.message) } }
async function confirm() {
  if (!selected.value || submitting.value) return
  const row = selected.value; submitting.value = true
  try {
    const result = await receivePackage(row)
    Object.assign(row, result, { received: true })
    toast(result.alreadyReceived ? '该批次此前已接收' : '接收成功')
    await refresh()
  } catch (error) { toast(error.message) } finally { submitting.value = false }
}
async function confirmSelected(rows) {
  if (submitting.value || !rows.length) return
  submitting.value = true; batchErrors.value = {}
  const context = state.contextKey; let success = 0; let failed = 0
  try {
    for (const row of rows) {
      if (state.contextKey !== context) break
      try {
        const result = await receivePackage(row)
        Object.assign(row, result, { received: true })
        success++; checkedIds.value = checkedIds.value.filter(id => id !== row.id)
      } catch (error) { failed++; batchErrors.value[row.id] = error.message }
    }
    if (state.contextKey === context) { toast(failed ? Object.values(batchErrors.value)[0] : `接收成功 ${success} 个`); await refresh() }
  } finally { submitting.value = false }
}
</script>
<style scoped>
.receive-content { display: flex; flex: 1; flex-direction: column; min-height: 0; padding: 20px var(--gutter) 0; overflow: hidden; }
.receive-content > :not(.package-selection):not(.pending-scroll):not(.selected-package):not(.received-history):not(.empty-state) { flex-shrink: 0; }
.receive-content .section-heading { margin-top: 10px; }
.selected-package { display: flex; flex: 0 1 auto; flex-direction: column; min-height: 0; max-height: 38%; }
.selected-scroll { flex: 1; height: 180px; min-height: 0; }
.app-shell .selected-confirm { flex-shrink: 0; width: 100%; }
.pending-scroll { flex: 1; height: 0; min-height: 0; }
.receive-content > .empty-state { flex: 1; min-height: 0; }
.received-history { display: flex; flex: 0 1 170px; flex-direction: column; min-height: 0; max-height: 30%; }
.received-history .section-heading { flex-shrink: 0; margin-bottom: 8px; }
.received-scroll { flex: 1; height: 0; min-height: 0; }
.app-shell .receive-content .record-link { margin-top: 12px; }
</style>
