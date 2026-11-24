<template>
  <view class="package-selection">
    <view class="selection-toolbar">
      <checkbox-group @change="toggleAll">
        <label class="selection-label"><checkbox value="all" :checked="allSelected" :disabled="disabled || !available.length" color="#147d73" /><text>全选</text></label>
      </checkbox-group>
      <text class="section-meta">已选 {{ selectedRows.length }} / {{ available.length }} 个</text>
    </view>
    <view v-for="row in rows" :key="row.id" :class="['package-item', { checked: modelValue.includes(row.id) }]">
      <view class="package-heading">
        <checkbox-group class="package-checkbox" @change="toggle(row.id, $event)">
          <label class="selection-label" :aria-label="'选择 ' + row.name + ' ' + (row.packageCode || row.no)"><checkbox value="selected" :checked="modelValue.includes(row.id)" :disabled="disabled || !selectable(row)" color="#147d73" /></label>
        </checkbox-group>
        <button class="package-toggle" :aria-expanded="expanded === row.id" @click="toggleExpanded(row)">
          <PatientSummary :row="row" :ward-in-title="compactDetails">
            <template v-if="compactDetails" #after-dose><text class="package-usage">{{ row.route }} · {{ row.frequency }}</text></template>
            <template v-if="compactDetails" #meta-end><text>处方时间：{{ row.prescriptionDate }}</text></template>
          </PatientSummary>
          <view :class="['expand-icon', { expanded: expanded === row.id }]"><AppIcon name="chevron-right" :size="18" /></view>
        </button>
      </view>
      <view v-if="expanded === row.id" :class="['package-details', { compact: compactDetails }]">
        <template v-if="!compactDetails">
          <view class="package-metadata"><text>药包码</text><text>{{ row.packageCode || '--' }}</text></view>
          <view class="package-metadata"><text>剂数 / 用法</text><text>{{ row.dose }} 剂 · {{ row.route }} · {{ row.frequency }}</text></view>
          <view class="package-metadata"><text>处方时间</text><text>{{ row.prescriptionDate }}</text></view>
        </template>
        <view v-if="row.wardName && !compactDetails" class="package-metadata"><text>病区</text><text>{{ row.wardName }}</text></view>
        <view class="drug-heading"><text>药品明细</text><text class="section-meta">每剂用量</text></view>
        <view class="drug-grid"><view v-for="(ingredient, index) in row.ingredients" :key="index" class="drug-row"><text>{{ ingredient.name }}</text><text class="drug-dose">{{ ingredient.grams }}g</text></view></view>
        <text v-if="!row.ingredients?.length" class="muted small">暂无药品明细</text>
        <slot :row="row" />
      </view>
    </view>
    <button class="primary-button batch-confirm" :disabled="disabled || !selectedRows.length" @click="confirmationOpen = true"><AppIcon name="check" :size="18" />{{ disabled ? '提交中' : actionLabel + '（' + selectedRows.length + '）' }}</button>
    <view v-if="confirmationOpen" class="modal-mask batch-modal" @click="confirmationOpen = false">
      <view class="batch-dialog" role="dialog" aria-modal="true" :aria-label="actionLabel" @click.stop>
        <text class="batch-dialog-title">{{ actionLabel }}</text>
        <text class="batch-dialog-message">{{ confirmationMessage || `确定对所选的 ${selectedRows.length} 个药包执行${actionLabel}操作吗？` }}</text>
        <view class="sheet-actions"><button class="secondary-button" @click="confirmationOpen = false">取消</button><button class="primary-button" :disabled="disabled || !selectedRows.length" @click="confirmSelection">确定</button></view>
      </view>
    </view>
  </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import PatientSummary from './PatientSummary.vue'
import { toast } from '../domain/pharmacy'
const props = defineProps({
  rows: { type: Array, default: () => [] }, modelValue: { type: Array, default: () => [] },
  disabled: Boolean, compactDetails: Boolean, actionLabel: { type: String, default: '确认验收' }, confirmationMessage: String,
  selectable: { type: Function, default: () => true }, blockedReason: { type: Function, default: () => '' }
})
const emit = defineEmits(['update:modelValue', 'confirm'])
const expanded = ref('')
const confirmationOpen = ref(false)
const available = computed(() => props.rows.filter(props.selectable))
const selectedRows = computed(() => available.value.filter(row => props.modelValue.includes(row.id)))
const allSelected = computed(() => available.value.length > 0 && selectedRows.value.length === available.value.length)
function toggleExpanded(row) {
  expanded.value = expanded.value === row.id ? '' : row.id
  if (!props.selectable(row)) toast(props.blockedReason(row) || '当前药包不可选择')
}
watch(() => selectedRows.value.map(row => row.id), () => { confirmationOpen.value = false })
function confirmSelection() {
  if (!confirmationOpen.value || props.disabled || !selectedRows.value.length) return
  confirmationOpen.value = false
  emit('confirm', [...selectedRows.value])
}
watch(() => available.value.map(row => row.id), ids => {
  const next = props.modelValue.filter(id => ids.includes(id))
  if (next.length !== props.modelValue.length) emit('update:modelValue', next)
})
function toggleAll(event) {
  if (!props.disabled) emit('update:modelValue', event.detail.value.includes('all') ? available.value.map(row => row.id) : [])
}
function toggle(id, event) {
  if (props.disabled) return
  emit('update:modelValue', event.detail.value.includes('selected') ? [...new Set([...props.modelValue, id])] : props.modelValue.filter(value => value !== id))
}
</script>
<style scoped>
.selection-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid #dfe8eb; }
.selection-label { display: flex; align-items: center; gap: 6px; min-height: 40px; font-size: 13px; }
.package-item { margin-bottom: 8px; border: 1px solid #dfe7ea; border-radius: 6px; background: #fff; overflow: hidden; }
.package-item.checked { border-color: #72ab9e; }
.package-heading { display: flex; align-items: center; padding: 0 10px; gap: 6px; }
.package-checkbox { flex-shrink: 0; }
.package-usage { min-width: 0; font-size: 12px; font-weight: 400; color: #658297; overflow-wrap: anywhere; }
.app-shell .package-toggle { flex: 1; min-width: 0; min-height: 64px; justify-content: space-between; gap: 6px; padding: 8px 0; text-align: left; }
.expand-icon { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex-shrink: 0; transition: transform .18s; }
.expand-icon.expanded { transform: rotate(90deg); }
.package-details { padding: 14px; border-top: 1px solid #e4ecee; }
.package-details.compact { padding-top: 8px; }
.package-details.compact .drug-heading { margin-top: 0; }
.package-metadata { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 9px; font-size: 11px; }
.package-metadata > text:first-child { flex-shrink: 0; color: #80939b; }
.package-metadata > text:last-child { min-width: 0; text-align: right; overflow-wrap: anywhere; }
.drug-heading { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 6px; font-size: 13px; font-weight: 600; }
.drug-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 16px; }
.drug-row { display: flex; justify-content: space-between; gap: 6px; padding: 8px 0; border-bottom: 1px solid #edf2f3; font-size: 12px; overflow-wrap: anywhere; }
.drug-dose { flex-shrink: 0; color: #147d73; }
.app-shell .batch-confirm { width: 100%; margin: 14px 0; }
.batch-modal { align-items: center; padding: 20px; }
.batch-dialog { width: 100%; max-width: 360px; padding: 22px; border-radius: 8px; background: #fff; }
.batch-dialog-title { display: block; font-size: 17px; font-weight: 600; }
.batch-dialog-message { display: block; margin: 14px 0 6px; color: #627b83; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
</style>
