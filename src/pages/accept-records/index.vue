<template>
  <AppShell title="验收明细" active="accept-records" back business-picker @business-change="refresh" @ward-change="refresh">
    <RecordList :key="state.business" kind="accept" paginated :records="records" :total="total" :start-time="startTime" :end-time="endTime" :patient-name="patientName" :loading="loading" :has-more="hasMore" :load-error="error" @date-change="changeDates" @patient-name-change="changePatientName" @load-more="loadMore" />
  </AppShell>
</template>
<script setup>
import AppShell from '../../components/AppShell.vue'
import RecordList from '../../components/RecordList.vue'
import { state } from '../../domain/pharmacy'
import { useRecordHistory } from '../../composables/useRecordHistory'
const { startTime, endTime, patientName, records, total, loading, hasMore, error, refresh, changeDates, changePatientName, loadMore } = useRecordHistory('accept')
</script>
