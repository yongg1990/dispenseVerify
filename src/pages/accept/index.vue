<template>
  <AppShell title="药包验收" active="accept" back @business-change="reset">
    <view class="page-heading"><text class="page-title">药房验收</text><text class="muted">{{ operator.name }} · 中药房</text></view>
    <ScanPanel title="扫描药包二维码" subtitle="药包验收" @scan="scan" />
    <view class="input-action"><view class="search-field"><AppIcon name="scan-line" :size="19" /><input v-model="code" placeholder="手动输入药包码 / 处方号" confirm-type="search" @confirm="lookup" /></view><button class="primary-button compact" @click="lookup">加载</button></view>
    <view class="section-heading"><text>本次扫描</text><text class="section-meta">{{ scanned.length }} 个药包</text></view>
    <PrescriptionCard v-for="row in scanned" :key="row.id" :row="row">
      <template v-if="!row.accepted && !row.acceptedAt">
        <view v-if="row.canAccept === false" class="warning-inline">{{ row.acceptanceBlockedReason || '当前药包不可验收' }}</view>
        <button class="primary-button card-action" :disabled="row.canAccept === false || submitting" @click="accept(row.id)"><AppIcon name="check" :size="18" />{{ submitting ? '提交中' : '确认验收' }}</button>
        <checkbox-group class="sms-reminder" @change="smsReminders[row.id] = $event.detail.value.includes('sms')"><label class="sms-reminder-label"><checkbox value="sms" :checked="smsReminders[row.id] !== false" :disabled="submitting" color="#147d73" /><text>短信提醒</text></label></checkbox-group>
      </template>
      <view v-else class="success-inline"><AppIcon name="circle-check" :size="17" /><text>验收完成 · {{ row.acceptedBy }}{{ row.smsSent ? ' · 已发送短信提醒' : '' }}</text></view>
      <view class="prescription-details">
        <view class="details-heading"><text>处方明细</text><text class="section-meta">每剂用量</text></view>
        <view class="ingredient-grid"><view v-for="(ingredient, index) in row.ingredients" :key="index" class="ingredient-row"><text class="ingredient-name">{{ ingredient.name }}</text><text class="ingredient-dose">{{ ingredient.grams }}g</text></view></view>
        <text v-if="!row.ingredients?.length" class="muted">暂无处方明细</text>
      </view>
    </PrescriptionCard>
    <EmptyState v-if="!scanned.length" icon="scan-line" title="等待扫描药包" subtitle="尚未加载处方" />
    <view class="section-heading"><text>今日验收记录</text><button class="text-button" @click="navigate('accept-records')">全部记录<AppIcon name="chevron-right" :size="15" /></button></view>
    <view class="compact-record" v-for="record in todayRecords('accept').slice(0, 3)" :key="record.entryId"><view class="activity-icon blue"><AppIcon name="package-check" :size="18" /></view><view class="grow"><text class="row-title">{{ record.name }} · {{ record.dose }} 剂</text><text class="row-subtitle">{{ record.no }}</text><text v-if="record.smsSent" class="sms-record-note">已发送短信提醒</text></view><text class="small muted">{{ record.time.slice(11, 16) }}</text></view>
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
import { state, operator, findPackage, acceptPackage, loadAcceptance, loadToday, refreshRequests, todayRecords, navigate, toast } from '../../domain/pharmacy'
import { scanCode } from '../../services/scanner'
const code = ref(''); const ids = ref([]); const submitting = ref(false); const loading = ref(false)
const smsReminders = ref({})
const scanned = computed(() => ids.value.map(id => state.rows.find(r => r.id === id)).filter(Boolean))
onShow(() => refresh())
async function refresh() { try { await refreshRequests([() => loadAcceptance(), () => loadToday('accept')]) } catch (error) { toast(error.message) } }
function reset() { code.value = ''; ids.value = []; smsReminders.value = {}; refresh() }
async function lookup() {
  if (loading.value || submitting.value) return
  loading.value = true
  try { const rows = await findPackage(code.value); for (const row of rows) if (!ids.value.includes(row.id)) ids.value.unshift(row.id); code.value = '' } catch (error) { toast(error.message) } finally { loading.value = false }
}
async function scan() { try { code.value = await scanCode({ type: 'accept', business: state.business }); await lookup() } catch (error) { toast(error.message) } }
async function accept(id) {
  if (submitting.value) return
  submitting.value = true
  try { const result = await acceptPackage(id, smsReminders.value[id] !== false); toast(result.smsSent ? '验收成功，已发送短信提醒' : '验收成功'); await refresh() } catch (error) { toast(error.message) } finally { submitting.value = false }
}
</script>

<style scoped>
.prescription-details { margin-top: 18px; padding-top: 14px; border-top: 1px solid #e1e9e8; }
.details-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; color: #264653; font-size: 14px; font-weight: 600; }
.ingredient-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 20px; }
.ingredient-row { display: flex; align-items: baseline; gap: 6px; min-width: 0; padding: 9px 0; border-bottom: 1px solid #edf2f3; font-size: 14px; }
.ingredient-name { min-width: 0; overflow-wrap: anywhere; color: #405d79; }
.ingredient-dose { flex-shrink: 0; color: #147d73; }
.sms-reminder { margin-top: 16px; }
.sms-reminder-label { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #405d79; }
.sms-record-note { display: block; margin-top: 4px; font-size: 12px; color: #147d73; }
.compact-record { padding: 15px 12px; border-left: 3px solid #668bc2; border-bottom-color: #dfe8f3; background: #eff4fb; }
.compact-record .row-title { color: #436b9b; }
.compact-record .row-subtitle, .compact-record .muted { color: #74879c; }
</style>
