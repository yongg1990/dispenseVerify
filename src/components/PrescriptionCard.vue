<template>
  <view class="prescription-card">
    <view class="card-top"><PatientSummary :row="row" prescription-header /><text :class="['status-badge', row.status]">{{ statusLabels[row.status] || row.status || '--' }}</text></view>
    <view class="card-tags"><text class="way-tag">{{ row.way }}</text><text v-if="row.split" class="batch-tag">拆分 · 批次 {{ row.batch }}</text></view>
    <view class="prescription-details">
      <view class="details-heading"><text>处方明细</text><text class="section-meta">每剂用量</text></view>
      <view class="ingredient-grid"><view v-for="(ingredient, index) in row.ingredients" :key="index" class="ingredient-row"><text class="ingredient-name">{{ ingredient.name }}</text><text class="ingredient-dose">{{ ingredient.grams }}g</text></view></view>
      <text v-if="!row.ingredients?.length" class="muted">暂无处方明细</text>
    </view>
    <view v-if="row.acceptedAt" class="card-foot"><AppIcon name="circle-check" :size="14" /><text>已验收 {{ row.acceptedAt }}</text></view>
    <view v-if="row.business === 'inpatient' && row.acceptedAt" class="ward-state">{{ row.received || row.receivedAt ? '病区已接收' : '待病区接收' }}</view>
    <slot />
  </view>
</template>
<script setup>
import AppIcon from './AppIcon.vue'
import PatientSummary from './PatientSummary.vue'
import { statusLabels } from '../domain/pharmacy'
defineProps({ row: { type: Object, required: true } })
</script>
<style scoped>
.card-top { align-items: flex-start; }
.card-tags { margin-top: 10px; }
.prescription-details { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
.details-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 14px; font-weight: 600; }
.ingredient-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 16px; }
.ingredient-row { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; min-width: 0; padding: 8px 0; font-size: 13px; }
.ingredient-name { min-width: 0; overflow-wrap: anywhere; color: #555b64; }
.ingredient-dose { flex-shrink: 0; color: var(--ink); font-variant-numeric: tabular-nums; }
@media (max-width: 400px) { .ingredient-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
