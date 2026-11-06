<template>
  <view class="prescription-card">
    <view class="card-top"><view class="patient-name">{{ row.name }}<text v-if="row.bed" class="bed-label">{{ row.bed }} 床</text></view><text :class="['status-badge', row.status]">{{ statusLabels[row.status] || row.status || '--' }}</text></view>
    <view class="prescription-number">{{ row.no }}</view>
    <view class="card-tags"><text class="way-tag">{{ row.way }}</text><text v-if="row.split" class="batch-tag">拆分 · 批次 {{ row.batch }}</text><text v-else class="muted small">普通处方</text></view>
    <view class="data-grid">
      <view><text class="field-label">剂数</text><text class="field-value">{{ row.dose }} 剂</text></view>
      <view><text class="field-label">途径 / 频次</text><text class="field-value">{{ row.route }} / {{ row.frequency }}</text></view>
      <view><text class="field-label">处方时间</text><text class="field-value">{{ row.prescriptionDate }}</text></view>
      <view><text class="field-label">{{ row.business === 'inpatient' ? '住院号' : '登记号' }}</text><text class="field-value">{{ row.inpatientNo || row.registrationNo }}</text></view>
    </view>
    <view v-if="row.acceptedAt" class="card-foot"><AppIcon name="circle-check" :size="14" /><text>已验收 {{ row.acceptedAt }}</text></view>
    <view v-if="row.business === 'inpatient' && row.acceptedAt" class="ward-state">{{ row.received || row.receivedAt ? '病区已接收' : '待病区接收' }}</view>
    <slot />
  </view>
</template>
<script setup>
import AppIcon from './AppIcon.vue'
import { statusLabels } from '../domain/pharmacy'
defineProps({ row: { type: Object, required: true } })
</script>
