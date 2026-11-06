<template><AppShell title="接收明细" active="records" back nursing @business-change="refresh"><view class="page-heading"><text class="page-title">病区接收记录</text><text class="muted">{{ currentWard.name }}</text></view><RecordList v-if="state.business === 'inpatient'" :key="state.business" kind="receive" /><EmptyState v-else title="病区接收仅适用于住院业务" /></AppShell></template>
<script setup>
import { onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import RecordList from '../../components/RecordList.vue'
import EmptyState from '../../components/EmptyState.vue'
import { state, currentWard, loadToday, toast } from '../../domain/pharmacy'
onShow(() => refresh())
async function refresh() { if (state.business === 'inpatient') { try { await loadToday('receive') } catch (error) { toast(error.message) } } }
</script>
