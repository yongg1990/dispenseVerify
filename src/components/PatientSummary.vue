<template>
  <view class="patient-summary">
    <view class="patient-title"><text>{{ row.name }}</text><text class="patient-demographic">{{ row.gender || '--' }}</text><text class="patient-demographic">{{ formatAge(row.age) }}</text><text class="dose-badge">{{ row.dose }}剂</text><text v-if="prescriptionHeader" class="patient-demographic">{{ row.route }} · {{ row.frequency }}</text><slot name="after-dose" /><template v-if="wardInTitle || prescriptionHeader"><text v-if="row.wardName && row.wardName !== '--'" class="patient-demographic">{{ row.wardName }}</text><text v-if="row.bed != null && row.bed !== '' && row.bed !== '--'" class="patient-demographic">{{ formatBed(row.bed) }}</text></template></view>
    <view class="patient-meta"><text>{{ row.business === 'inpatient' ? '住院号' : '登记号' }}：{{ (row.business === 'inpatient' ? row.inpatientNo : row.registrationNo) || '--' }}</text><text v-if="row.business === 'inpatient' && !wardInTitle && !prescriptionHeader">病区：{{ row.wardName || '--' }}</text><text v-if="row.business === 'inpatient' && !wardInTitle && !prescriptionHeader">床位：{{ row.bed || '--' }}</text><text>处方号：{{ row.no }}</text><text v-if="row.split">执行批次：{{ row.batch }}</text><text v-if="prescriptionHeader">处方时间：{{ row.prescriptionDate }}</text><slot name="meta-end" /></view>
  </view>
</template>
<script setup>
defineProps({ row: { type: Object, required: true }, wardInTitle: Boolean, prescriptionHeader: Boolean })
function formatBed(bed) {
  const value = String(bed).trim().replace(/床$/, '').trim()
  return `${/^\d+$/.test(value) ? Number(value) : value}床`
}
function formatAge(age) {
  if (age === undefined || age === null || age === '') return '--'
  return /^\d+(\.\d+)?$/.test(String(age)) ? `${age} 岁` : age
}
</script>
<style scoped>
.patient-summary { flex: 1; min-width: 0; }
.patient-title { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; font-size: 15px; line-height: 1.4; font-weight: 600; }
.patient-demographic { font-size: 12px; color: #658297; font-weight: 400; }
.dose-badge { display: inline-block; flex-shrink: 0; padding: 0 5px; border: 1px solid #d6e5f2; border-radius: 3px; background: #eff6fc; color: #3979ad; font-size: 11px; font-weight: 400; line-height: 16px; white-space: nowrap; }
.patient-meta { display: flex; flex-wrap: wrap; column-gap: 8px; row-gap: 1px; margin-top: 3px; font-size: 11px; line-height: 1.4; color: #80939b; overflow-wrap: anywhere; }
.patient-meta > text { min-width: 0; }
</style>
