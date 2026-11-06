<template>
  <view class="record-toolbar"><text class="muted">共 <text class="strong">{{ todayCount(kind) }}</text> {{ kind === 'receive' ? '包' : '条' }}记录</text><view class="range-switch"><button class="active">今日</button><button disabled>全部</button></view></view>
  <view v-if="statDate" class="section-meta">{{ statDate }}</view>
  <view v-if="kind === 'accept' && !useStaticData" class="warning-inline">接口文档未提供验收明细查询接口</view>
  <view class="search-field"><AppIcon name="search" :size="18" /><input v-model="keyword" placeholder="姓名 / 处方号 / 登记号 / 床号" confirm-type="search" /><button v-if="keyword" class="icon-button small-icon" aria-label="清空" @click="keyword = ''"><AppIcon name="x" :size="16" /></button></view>
  <view v-for="record in filtered" :key="record.entryId" class="record-card">
    <view class="card-top"><text class="patient-name">{{ record.name }}<text v-if="record.bed" class="bed-label">{{ record.bed }} 床</text></text><text :class="['status-badge', kind === 'accept' ? 'accepted' : 'dispensed']">{{ kind === 'accept' ? '验收完成' : kind === 'receive' ? '接收完成' : '发药完成' }}</text></view>
    <text class="prescription-number">{{ record.no }}</text>
    <view class="record-drugs"><text>{{ record.dose }} 剂</text><text class="way-tag">{{ record.way }}</text><text v-if="record.split" class="batch-tag">批次 {{ record.batch }}</text></view>
    <view v-if="kind === 'accept' && record.smsSent" class="success-inline"><AppIcon name="message-square" :size="15" /><text>已发送短信提醒</text></view>
    <view class="record-metadata"><view v-if="kind === 'receive'"><text>药包码</text><text>{{ record.packageCode }}</text></view><view><text>{{ kind === 'accept' ? '验收时间' : kind === 'receive' ? '接收时间' : '发药时间' }}</text><text>{{ record.time }}</text></view><view><text>操作人</text><text>{{ record.operator }} · {{ hospital.name }}</text></view><view v-if="kind === 'dispense'"><text>验收时间</text><text>{{ record.acceptedAt || '--' }}</text></view></view>
  </view>
  <EmptyState v-if="!filtered.length" :title="kind === 'accept' ? '暂无验收记录' : kind === 'receive' ? '暂无接收记录' : '暂无发药记录'" />
</template>
<script setup>
import { ref, computed } from 'vue'
import { useStaticData } from '../services/data-source'
import { visibleRecords, hospital, state, todayCount } from '../domain/pharmacy'
import AppIcon from './AppIcon.vue'
import EmptyState from './EmptyState.vue'
const props = defineProps({ kind: String })
const keyword = ref('')
const statDate = computed(() => props.kind === 'receive' ? state.receiveStatDate : props.kind === 'dispense' ? state.dispenseStatDate : '')
const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return visibleRecords(props.kind).filter(r => !k || [r.name, r.no, r.registrationNo, r.inpatientNo, r.bed, r.packageCode].some(v => v != null && String(v).toLowerCase().includes(k)))
})
</script>
