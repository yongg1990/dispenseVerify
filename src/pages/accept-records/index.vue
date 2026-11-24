<template><AppShell title="验收明细" active="accept-records" back @business-change="refresh"><view class="page-heading"><text class="page-title">验收记录</text><text class="muted">{{ businessLabel }}业务</text></view><RecordList :key="state.business" kind="accept" paginated :records="records" :total="total" :start-time="startTime" :end-time="endTime" :loading="loading" :has-more="hasMore" :load-error="error" @date-change="changeDates" @load-more="loadMore" /></AppShell></template>
<script setup>
import AppShell from '../../components/AppShell.vue'
import RecordList from '../../components/RecordList.vue'
import { state, businessLabel } from '../../domain/pharmacy'
import { useRecordHistory } from '../../composables/useRecordHistory'
const { startTime, endTime, records, total, loading, hasMore, error, refresh, changeDates, loadMore } = useRecordHistory('accept')
</script>
