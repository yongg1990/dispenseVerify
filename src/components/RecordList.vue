<template>
  <view class="record-toolbar"><text class="muted">共 <text class="strong">{{ paginated ? (total ?? records.length) : todayCount(kind) }}</text> {{ kind === 'receive' ? '包' : '条' }}记录</text><view v-if="!paginated" class="range-switch"><button class="active">今日</button><button disabled>全部</button></view></view>
  <view v-if="paginated" class="date-range">
    <view class="date-field"><text>开始日期</text><picker mode="date" :value="startTime" :end="endTime" @change="changeStart"><view class="date-value"><text>{{ startTime }}</text><AppIcon name="chevron-right" :size="14" /></view></picker></view>
    <view class="date-field"><text>结束日期</text><picker mode="date" :value="endTime" :start="startTime" @change="changeEnd"><view class="date-value"><text>{{ endTime }}</text><AppIcon name="chevron-right" :size="14" /></view></picker></view>
  </view>
  <view v-else-if="statDate" class="section-meta">{{ statDate }}</view>
  <view class="search-field"><AppIcon name="search" :size="18" /><input v-model="keyword" placeholder="姓名 / 处方号 / 登记号 / 床号" confirm-type="search" /><button v-if="keyword" class="icon-button small-icon" aria-label="清空" @click="keyword = ''"><AppIcon name="x" :size="16" /></button></view>
  <view v-for="record in filtered" :key="record.entryId" class="record-card">
    <view :class="['card-top', { 'summary-header': kind !== 'receive' }]"><PatientSummary v-if="kind !== 'receive'" :row="record" prescription-header><template #after-dose><text class="way-tag">{{ record.way }}</text></template></PatientSummary><text v-else class="patient-name">{{ record.name }}<text v-if="record.bed" class="bed-label">{{ record.bed }} 床</text></text><text :class="['status-badge', kind === 'accept' ? 'accepted' : 'dispensed']">{{ kind === 'accept' ? '验收完成' : kind === 'receive' ? '接收完成' : '发药完成' }}</text></view>
    <text v-if="kind === 'receive'" class="prescription-number">{{ record.no }}</text>
    <view v-if="kind === 'receive' || record.split" class="record-drugs"><template v-if="kind === 'receive'"><text>{{ record.dose }} 剂</text><text class="way-tag">{{ record.way }}</text></template><text v-if="record.split" class="batch-tag">批次 {{ record.batch }}</text></view>
    <view v-if="kind === 'accept' && record.smsSent" class="success-inline"><AppIcon name="message-square" :size="15" /><text>已发送短信提醒</text></view>
    <view class="record-metadata"><view v-if="kind === 'receive'"><text>药包码</text><text>{{ record.packageCode }}</text></view><view><text>{{ kind === 'accept' ? '验收时间' : kind === 'receive' ? '接收时间' : '发药时间' }}</text><text>{{ record.time }}</text></view><view><text>操作人</text><text>{{ record.operator }} · {{ hospital.name }}</text></view><view v-if="kind === 'dispense'"><text>验收时间</text><text>{{ record.acceptedAt || '--' }}</text></view></view>
  </view>
  <EmptyState v-if="!filtered.length && !loading && !loadError" icon-only :title="kind === 'accept' ? '暂无验收记录' : kind === 'receive' ? '暂无接收记录' : '暂无发药记录'" />
  <view v-if="paginated" class="pagination-status">
    <text v-if="loading" class="muted">加载中…</text>
    <button v-else-if="loadError" class="text-button" @click="$emit('load-more')">重试</button>
    <button v-else-if="hasMore" class="text-button" @click="$emit('load-more')">加载更多<AppIcon name="chevron-right" :size="14" /></button>
    <text v-else-if="records.length" class="muted">已加载全部记录</text>
  </view>
</template>
<script setup>
import { ref, computed } from 'vue'
import { visibleRecords, hospital, state, todayCount } from '../domain/pharmacy'
import AppIcon from './AppIcon.vue'
import EmptyState from './EmptyState.vue'
import PatientSummary from './PatientSummary.vue'
const props = defineProps({
  kind: String, paginated: Boolean, records: { type: Array, default: () => [] },
  total: { type: Number, default: null }, startTime: String, endTime: String,
  loading: Boolean, hasMore: Boolean, loadError: Boolean
})
const emit = defineEmits(['date-change', 'load-more'])
function changeStart(event) { emit('date-change', { startTime: event.detail.value, endTime: props.endTime }) }
function changeEnd(event) { emit('date-change', { startTime: props.startTime, endTime: event.detail.value }) }
const keyword = ref('')
const statDate = computed(() => props.kind === 'receive' ? state.receiveStatDate : props.kind === 'dispense' ? state.dispenseStatDate : state.acceptanceStatDate)
const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return (props.paginated ? props.records : visibleRecords(props.kind)).filter(r => !k || [r.name, r.no, r.registrationNo, r.inpatientNo, r.bed, r.packageCode].some(v => v != null && String(v).toLowerCase().includes(k)))
})
</script>
<style scoped>
.summary-header { align-items: flex-start; margin-bottom: 13px; }
.date-range { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; margin-bottom: 16px; }
.date-field { min-width: 0; }
.date-field > text { display: block; margin-bottom: 6px; color: var(--muted); font-size: 11px; }
.date-value { display: flex; align-items: center; justify-content: space-between; gap: 4px; min-height: 42px; padding: 8px; border: 1px solid var(--line); border-radius: 6px; background: #fff; font-size: 12px; }
.date-value > text { min-width: 0; overflow-wrap: anywhere; }
.search-field { margin-bottom: 16px; }
.pagination-status { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 0; text-align: center; font-size: 12px; }
.pagination-status .text-button { min-height: 36px; }
</style>
