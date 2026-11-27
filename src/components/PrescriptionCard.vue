<template>
  <view class="prescription-card">
    <view class="card-top">
      <PatientSummary :row="row" prescription-header compact>
        <template #meta-end><text class="way-tag">{{ row.way }}</text><text v-if="row.split" class="batch-tag">拆分</text></template>
      </PatientSummary>
      <text :class="['status-badge', row.status]">{{ statusLabels[row.status] || row.status || '--' }}</text>
    </view>
    <view class="prescription-details">
      <button class="details-heading" :aria-expanded="detailsExpanded" :aria-label="detailsExpanded ? '收起处方明细' : '展开处方明细'" @click="detailsExpanded = !detailsExpanded">
        <text>处方明细</text>
        <view class="details-toggle"><text v-if="detailsExpanded" class="section-meta">每剂用量</text><AppIcon name="chevron-right" :size="16" :class="['details-arrow', { expanded: detailsExpanded }]" /></view>
      </button>
      <view v-if="detailsExpanded" class="details-content">
        <view class="ingredient-grid"><view v-for="(ingredient, index) in row.ingredients" :key="index" class="ingredient-row"><text class="ingredient-name">{{ ingredient.name }}</text><text class="ingredient-dose">{{ ingredient.grams }}g</text></view></view>
        <text v-if="!row.ingredients?.length" class="muted">暂无处方明细</text>
      </view>
    </view>
    <view v-if="row.acceptedAt" class="card-foot"><AppIcon name="circle-check" :size="14" /><text>已验收 {{ row.acceptedAt }}</text></view>
    <view v-if="row.business === 'inpatient' && row.acceptedAt" class="ward-state">{{ row.received || row.receivedAt ? '病区已接收' : '待病区接收' }}</view>
    <slot />
  </view>
</template>
<script setup>
import { ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import PatientSummary from './PatientSummary.vue'
import { statusLabels } from '../domain/pharmacy'
const props = defineProps({ row: { type: Object, required: true }, defaultExpanded: Boolean })
const detailsExpanded = ref(props.defaultExpanded)
watch(() => [props.row, props.defaultExpanded], () => { detailsExpanded.value = props.defaultExpanded })
</script>
<style scoped>
.card-top { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 6px 8px; }
.card-top :deep(.patient-summary) { display: contents; }
.card-top :deep(.patient-title) { grid-column: 1; grid-row: 1; }
.card-top > .status-badge { grid-column: 2; grid-row: 1; }
.card-top :deep(.patient-meta) { grid-column: 1 / -1; grid-row: 2; gap: 3px 12px; margin-top: 0; }
.way-tag, .batch-tag { padding: 0 5px; line-height: 16px; }
.prescription-details { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--line); }
.app-shell .details-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 32px; padding: 0; text-align: left; font-size: 14px; font-weight: 600; }
.details-toggle { display: flex; align-items: center; gap: 8px; }
.details-arrow { opacity: .5; transition: transform .18s; }
.details-arrow.expanded { transform: rotate(90deg); }
.details-content { padding-top: 6px; }
.ingredient-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 16px; }
.ingredient-row { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; min-width: 0; padding: 8px 0; font-size: 13px; }
.ingredient-name { min-width: 0; overflow-wrap: anywhere; color: #555b64; }
.ingredient-dose { flex-shrink: 0; color: var(--ink); font-variant-numeric: tabular-nums; }
@media (max-width: 400px) { .ingredient-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
