<template>
  <AppShell title="药包验收" active="accept" back business-picker fixed-content @business-change="reset" @ward-change="reset" @conflict="refresh">
    <view class="acceptance-content">
    <view class="record-toolbar"><view class="range-switch entry-switch"><button :class="{ active: entry === 'scan' }" :disabled="submitting" @click="entry = 'scan'">扫码验收</button><button :class="{ active: entry === 'manual' }" :disabled="submitting" @click="entry = 'manual'">批量验收</button></view></view>
    <template v-if="entry === 'scan'">
    <ScanPanel title="扫描药包二维码" subtitle="药包验收" @scan="scan" />
    <view class="input-action"><view class="search-field"><AppIcon name="scan-line" :size="19" /><input v-model="code" placeholder="手动输入药包码 / 处方号" confirm-type="search" @confirm="lookup" /></view><button class="primary-button compact" @click="lookup">查询</button></view>
    <view class="section-heading"><text>本次扫描</text><text class="section-meta">{{ scanned.length }} 个药包</text></view>
    <scroll-view v-if="scanned.length" scroll-y class="acceptance-scroll">
      <PrescriptionCard v-for="row in scanned" :key="`${row.id}:${scanRevisions[row.id] || 0}`" :row="row" default-expanded>
        <template v-if="!row.accepted && !row.acceptedAt">
          <button class="primary-button card-action" :disabled="row.canAccept === false || submitting" @click="accept(row.id)"><AppIcon name="check" :size="18" />{{ submitting ? '提交中' : '确认验收' }}</button>
          <checkbox-group class="sms-reminder" @change="smsReminders[row.id] = $event.detail.value.includes('sms')"><label class="sms-reminder-label"><checkbox value="sms" :checked="shouldSendSms(row.id)" :disabled="row.canAccept === false || submitting" color="#147d73" /><text>短信提醒</text></label></checkbox-group>
        </template>
        <view v-else class="success-inline"><AppIcon name="circle-check" :size="17" /><text>验收完成 · {{ row.acceptedBy }}{{ row.smsSent ? ' · 已发送短信提醒' : '' }}</text></view>
      </PrescriptionCard>
    </scroll-view>
    <EmptyState v-if="!scanned.length" icon="scan-line" title="等待扫描药包" subtitle="尚未加载处方" />
    </template>
    <template v-else>
      <view class="section-heading"><text>待验收药包</text><text class="section-meta">{{ pending.length }} 个药包</text></view>
      <view class="input-action"><view class="search-field"><AppIcon name="search" :size="18" /><input v-model="draft" placeholder="患者姓名" confirm-type="search" @confirm="search" /><button v-if="draft" class="icon-button small-icon" aria-label="清空搜索" @click="clearSearch"><AppIcon name="x" :size="15" /></button></view><button class="primary-button compact" @click="search">搜索</button></view>
      <PackageSelection v-if="pending.length" v-model="checkedIds" compact-details scrollable :rows="pending" :selectable="canSelect" :blocked-reason="row => row.acceptanceBlockedReason" :disabled="submitting" action-label="确认验收" @confirm="acceptSelected">
        <template #default="{ row }"><checkbox-group class="sms-reminder" @change="batchSmsReminders[row.id] = $event.detail.value.includes('sms')"><label class="sms-reminder-label"><checkbox value="sms" :checked="batchSmsReminders[row.id] === true" :disabled="!canSelect(row) || submitting" color="#147d73" /><text>短信提醒</text></label></checkbox-group></template>
      </PackageSelection>
      <EmptyState v-else icon-only title="暂无待验收药包" />
    </template>
    <button class="record-link" @click="navigate('accept-records')"><AppIcon name="clipboard-check" :size="20" /><text class="grow">今日已验收</text><text class="strong">{{ todayCount('accept') }} 条</text><AppIcon name="chevron-right" :size="18" /></button>
    </view>
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
import PackageSelection from '../../components/PackageSelection.vue'
import { state, operator, findPackage, acceptPackage, loadAcceptance, loadToday, refreshRequests, todayCount, navigate, toast } from '../../domain/pharmacy'
import { scanCode } from '../../services/scanner'
const code = ref(''); const ids = ref([]); const submitting = ref(false); const loading = ref(false)
const draft = ref(''); const keyword = ref('')
const scanRevisions = ref({})
const smsReminders = ref({})
const batchSmsReminders = ref({})
const shouldSendSms = id => smsReminders.value[id] ?? (state.business !== 'inpatient')
const entry = ref('scan'); const checkedIds = ref([]); const batchErrors = ref({})
const pending = computed(() => state.acceptanceRows.filter(row => !row.accepted && !row.acceptedAt && (!keyword.value || String(row.name ?? '').toLowerCase().includes(keyword.value.toLowerCase()))))
const canSelect = row => !row.accepted && !row.acceptedAt && row.canAccept !== false
const scanned = computed(() => ids.value.map(id => state.rows.find(r => r.id === id)).filter(Boolean))
onShow(() => refresh())
async function refresh() { try { await refreshRequests([() => loadAcceptance(), () => loadToday('accept')]) } catch (error) { toast(error.message) } }
function search() { keyword.value = draft.value.trim() }
function clearSearch() { draft.value = ''; keyword.value = '' }
function reset() { code.value = ''; ids.value = []; scanRevisions.value = {}; smsReminders.value = {}; batchSmsReminders.value = {}; checkedIds.value = []; batchErrors.value = {}; clearSearch(); refresh() }
async function lookup() {
  if (loading.value || submitting.value) return
  loading.value = true
  try {
    const rows = await findPackage(code.value)
    for (const row of rows) {
      scanRevisions.value[row.id] = (scanRevisions.value[row.id] || 0) + 1
      if (!ids.value.includes(row.id)) ids.value.unshift(row.id)
    }
    code.value = ''
    const blocked = rows.find(row => row.canAccept === false)
    if (blocked) toast(blocked.acceptanceBlockedReason || '当前药包不可验收')
  } catch (error) { toast(error.message) } finally { loading.value = false }
}
async function scan() { try { code.value = await scanCode({ type: 'accept', business: state.business }); await lookup() } catch (error) { toast(error.message) } }
async function accept(id) {
  if (submitting.value) return
  submitting.value = true
  try { const result = await acceptPackage(id, shouldSendSms(id)); toast(result.smsSent === true ? '验收成功，已发送短信提醒' : '验收成功'); await refresh() } catch (error) { toast(error.message) } finally { submitting.value = false }
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
.acceptance-content { display: flex; flex: 1; flex-direction: column; min-height: 0; padding: 20px var(--gutter) 0; overflow: hidden; }
.acceptance-content > :not(.package-selection):not(.acceptance-scroll):not(.empty-state) { flex-shrink: 0; }
.acceptance-content .section-heading { margin-top: 10px; }
.acceptance-scroll { flex: 1; height: 0; min-height: 0; }
.acceptance-content > .empty-state { flex: 1; min-height: 0; }
.app-shell .acceptance-content .record-link { margin-top: 12px; }
.sms-reminder { margin-top: 16px; }
.sms-reminder-label { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #405d79; }
</style>
