<template>
  <view v-if="paginated" class="record-filters">
    <view class="filter-row">
      <text class="filter-label">日期范围</text>
      <view class="filter-control">
        <UniDatetimePicker type="daterange" :model-value="dateRange" :clear-icon="false" range-separator="至" @change="changeDates">
          <view class="date-value" role="button" aria-label="选择日期范围"><text>{{ startTime }} 至 {{ endTime }}</text><AppIcon name="chevron-right" :size="14" /></view>
        </UniDatetimePicker>
      </view>
    </view>
    <view class="filter-row">
      <text class="filter-label">患者姓名</text>
      <view class="filter-control patient-query">
        <view class="search-field patient-name-field"><input v-model="draftPatientName" :maxlength="100" aria-label="患者姓名" placeholder="请输入患者姓名" confirm-type="search" @confirm="searchPatient" /><button v-if="draftPatientName" class="icon-button small-icon" aria-label="清空患者姓名" @click="clearPatientName"><AppIcon name="x" :size="16" /></button></view>
        <button class="primary-button query-button" @click="searchPatient"><AppIcon name="search" :size="16" /><text>查询</text></button>
      </view>
    </view>
  </view>
  <view v-else class="search-field"><AppIcon name="search" :size="18" /><input v-model="keyword" placeholder="姓名 / 处方号 / 登记号 / 床号" confirm-type="search" /><button v-if="keyword" class="icon-button small-icon" aria-label="清空" @click="keyword = ''"><AppIcon name="x" :size="16" /></button></view>
  <view class="record-toolbar"><text class="muted">共 <text class="strong">{{ paginated ? (total ?? records.length) : todayCount(kind) }}</text> {{ kind === 'receive' ? '包' : '条' }}记录</text><text v-if="!paginated" class="section-meta">{{ statDate || '今日' }}</text></view>
  <view v-for="record in filtered" :key="record.entryId" class="record-card">
    <view :class="['card-top', { 'summary-header': kind !== 'receive' }]"><PatientSummary v-if="kind !== 'receive'" :row="record" ward-in-title prescription-header compact /><text v-else class="patient-name">{{ record.name }}<text v-if="record.bed" class="bed-label">{{ record.bed }} 床</text></text><text :class="['status-badge', kind === 'accept' ? 'accepted' : 'dispensed']">{{ kind === 'accept' ? '验收完成' : kind === 'receive' ? '接收完成' : '发药完成' }}</text></view>
    <text v-if="kind === 'receive'" class="prescription-number">{{ record.no }}</text>
    <view v-if="kind === 'receive'" class="record-drugs"><text>{{ record.dose }} 剂</text><text class="way-tag">{{ record.way }}</text><text v-if="record.split" class="batch-tag">批次 {{ record.batch }}</text></view>
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
import { ref, computed, watch } from 'vue'
import { visibleRecords, hospital, state, todayCount } from '../domain/pharmacy'
import AppIcon from './AppIcon.vue'
import EmptyState from './EmptyState.vue'
import PatientSummary from './PatientSummary.vue'
import UniDatetimePicker from '@dcloudio/uni-ui/lib/uni-datetime-picker/uni-datetime-picker.vue'
const props = defineProps({
  kind: String, paginated: Boolean, records: { type: Array, default: () => [] },
  total: { type: Number, default: null }, startTime: String, endTime: String, patientName: { type: String, default: '' },
  loading: Boolean, hasMore: Boolean, loadError: Boolean
})
const emit = defineEmits(['date-change', 'patient-name-change', 'load-more'])
const dateRange = computed(() => [props.startTime, props.endTime])
function changeDates(value) {
  if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
    emit('date-change', { startTime: value[0], endTime: value[1] })
  }
}
const draftPatientName = ref(props.patientName ?? '')
watch(() => props.patientName, value => { draftPatientName.value = value ?? '' })
function searchPatient() { emit('patient-name-change', String(draftPatientName.value ?? '').trim()) }
function clearPatientName() { draftPatientName.value = ''; searchPatient() }
const keyword = ref('')
const statDate = computed(() => props.kind === 'receive' ? state.receiveStatDate : props.kind === 'dispense' ? state.dispenseStatDate : state.acceptanceStatDate)
const filtered = computed(() => {
  if (props.paginated) return props.records
  const k = keyword.value.trim().toLowerCase()
  return visibleRecords(props.kind).filter(r => !k || [r.name, r.no, r.registrationNo, r.inpatientNo, r.bed, r.packageCode].some(v => v != null && String(v).toLowerCase().includes(k)))
})
</script>
<style scoped>
.summary-header { align-items: flex-start; }
.record-filters { display: flex; flex-direction: column; gap: 12px; margin: -20px calc(0px - var(--gutter)) 16px; padding: 16px var(--gutter); border-bottom: 1px solid var(--line); background: var(--paper); }
.filter-row { display: flex; align-items: center; gap: 12px; }
.filter-label { flex: 0 0 56px; color: var(--muted); font-size: 13px; }
.filter-control { flex: 1; min-width: 0; }
.date-value { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 44px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--page); font-size: 13px; font-variant-numeric: tabular-nums; }
.date-value > text { min-width: 0; overflow-wrap: anywhere; }
.date-value .app-icon { transform: rotate(90deg); opacity: .4; }
.search-field { margin-bottom: 16px; }
.patient-query { display: flex; align-items: stretch; gap: 8px; }
.patient-name-field { margin-bottom: 0; padding: 0 10px; background: var(--page); }
.patient-name-field input { height: 42px; font-size: 13px; }
.record-filters .query-button { flex-shrink: 0; gap: 4px; min-width: 72px; min-height: 44px; padding: 0 10px; font-size: 13px; }
.pagination-status { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 0; text-align: center; font-size: 12px; }
.pagination-status .text-button { min-height: 36px; }
</style>
