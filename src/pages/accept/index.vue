<template>
  <AppShell title="药包验收" active="accept" back @business-change="reset" @conflict="refresh">
    <view class="page-heading"><text class="page-title">药房验收</text><text class="muted">{{ operator.name }} · 中药房</text></view>
    <view class="record-toolbar"><view class="range-switch entry-switch"><button :class="{ active: entry === 'scan' }" :disabled="submitting" @click="entry = 'scan'">扫码验收</button><button :class="{ active: entry === 'manual' }" :disabled="submitting" @click="entry = 'manual'">批量验收</button></view></view>
    <template v-if="entry === 'scan'">
    <ScanPanel title="扫描药包二维码" subtitle="药包验收" @scan="scan" />
    <view class="input-action"><view class="search-field"><AppIcon name="scan-line" :size="19" /><input v-model="code" placeholder="手动输入药包码 / 处方号" confirm-type="search" @confirm="lookup" /></view><button class="primary-button compact" @click="lookup">查询</button></view>
    <view class="section-heading"><text>本次扫描</text><text class="section-meta">{{ scanned.length }} 个药包</text></view>
    <PrescriptionCard v-for="row in scanned" :key="row.id" :row="row">
      <template v-if="!row.accepted && !row.acceptedAt">
        <button class="primary-button card-action" :disabled="row.canAccept === false || submitting" @click="accept(row.id)"><AppIcon name="check" :size="18" />{{ submitting ? '提交中' : '确认验收' }}</button>
        <checkbox-group class="sms-reminder"><label class="sms-reminder-label"><checkbox value="sms" :checked="false" disabled color="#147d73" /><text>短信提醒（暂未接入）</text></label></checkbox-group>
      </template>
      <view v-else class="success-inline"><AppIcon name="circle-check" :size="17" /><text>验收完成 · {{ row.acceptedBy }}{{ row.smsSent ? ' · 已发送短信提醒' : '' }}</text></view>
    </PrescriptionCard>
    <EmptyState v-if="!scanned.length" icon="scan-line" title="等待扫描药包" subtitle="尚未加载处方" />
    </template>
    <template v-else>
      <view class="section-heading"><text>待验收药包</text><text class="section-meta">{{ pending.length }} 个药包</text></view>
      <PackageSelection v-if="pending.length" v-model="checkedIds" compact-details :rows="pending" :selectable="canSelect" :blocked-reason="row => row.acceptanceBlockedReason" :disabled="submitting" action-label="确认验收" @confirm="acceptSelected">
        <template #default><text class="small muted">短信提醒暂未接入</text></template>
      </PackageSelection>
      <EmptyState v-else icon-only title="暂无待验收药包" />
    </template>
    <view class="section-heading"><text>今日验收记录</text><button class="text-button" @click="navigate('accept-records')">全部记录<AppIcon name="chevron-right" :size="15" /></button></view>
    <view class="compact-record" v-for="record in todayRecords('accept').slice(0, 3)" :key="record.entryId"><view class="grow"><PatientSummary :row="record" prescription-header /><text class="row-subtitle">{{ record.operator }} · {{ record.time }}</text><text v-if="record.smsSent" class="sms-record-note">已发送短信提醒</text></view></view>
    <EmptyState v-if="!todayRecords('accept').length" icon-only title="暂无验收记录" />
  </AppShell>
</template>
<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import ScanPanel from '../../components/ScanPanel.vue'
import EmptyState from '../../components/EmptyState.vue'
import PrescriptionCard from '../../components/PrescriptionCard.vue'
import PatientSummary from '../../components/PatientSummary.vue'
import PackageSelection from '../../components/PackageSelection.vue'
import { state, operator, findPackage, acceptPackage, loadAcceptance, loadToday, refreshRequests, todayRecords, navigate, toast } from '../../domain/pharmacy'
import { scanCode } from '../../services/scanner'
const code = ref(''); const ids = ref([]); const submitting = ref(false); const loading = ref(false)
const smsReminders = ref({})
const batchSmsReminders = ref({})
const shouldSendSms = id => smsReminders.value[id] ?? (state.business !== 'inpatient')
const entry = ref('scan'); const checkedIds = ref([]); const batchErrors = ref({})
const pending = computed(() => state.acceptanceRows.filter(row => !row.accepted && !row.acceptedAt))
const canSelect = row => !row.accepted && !row.acceptedAt && row.canAccept !== false
const scanned = computed(() => ids.value.map(id => state.rows.find(r => r.id === id)).filter(Boolean))
onShow(() => refresh())
async function refresh() { try { await refreshRequests([() => loadAcceptance(), () => loadToday('accept')]) } catch (error) { toast(error.message) } }
function reset() { entry.value = 'scan'; code.value = ''; ids.value = []; smsReminders.value = {}; batchSmsReminders.value = {}; checkedIds.value = []; batchErrors.value = {}; refresh() }
async function lookup() {
  if (loading.value || submitting.value) return
  loading.value = true
  try {
    const rows = await findPackage(code.value)
    for (const row of rows) if (!ids.value.includes(row.id)) ids.value.unshift(row.id)
    code.value = ''
    const blocked = rows.find(row => row.canAccept === false)
    if (blocked) toast(blocked.acceptanceBlockedReason || '当前药包不可验收')
  } catch (error) { toast(error.message) } finally { loading.value = false }
}
async function scan() { try { code.value = await scanCode({ type: 'accept', business: state.business }); await lookup() } catch (error) { toast(error.message) } }
async function accept(id) {
  if (submitting.value) return
  submitting.value = true
  try { const result = await acceptPackage(id, shouldSendSms(id)); toast(result.smsSent ? '验收成功，已发送短信提醒' : '验收成功'); await refresh() } catch (error) { toast(error.message) } finally { submitting.value = false }
}
async function acceptSelected(rows) {
  if (submitting.value || !rows.length) return
  submitting.value = true; batchErrors.value = {}
  const context = state.contextKey; let success = 0; let failed = 0
  try {
    for (const row of rows) {
      if (state.contextKey !== context) break
      try {
        await acceptPackage(row.id, batchSmsReminders.value[row.id] === true)
        success++; checkedIds.value = checkedIds.value.filter(id => id !== row.id)
      } catch (error) { failed++; batchErrors.value[row.id] = error.message }
    }
    if (state.contextKey === context) { toast(failed ? Object.values(batchErrors.value)[0] : `验收成功 ${success} 个`); await refresh() }
  } finally { submitting.value = false }
}
</script>

<style scoped>
.sms-reminder { margin-top: 16px; }
.sms-reminder-label { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #405d79; }
.sms-record-note { display: block; margin-top: 4px; font-size: 12px; color: #147d73; }
.compact-record { padding: 15px 12px; border-left: 3px solid #668bc2; border-bottom-color: #dfe8f3; background: #eff4fb; }
.compact-record .row-title { color: #436b9b; }
.compact-record .row-subtitle, .compact-record .muted { color: #74879c; }
</style>
