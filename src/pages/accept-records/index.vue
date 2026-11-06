<template><AppShell title="验收明细" active="records" back @business-change="refresh"><view class="page-heading"><text class="page-title">验收记录</text><text class="muted">{{ businessLabel }}业务</text></view><RecordList :key="state.business" kind="accept" /></AppShell></template>
<script setup>
import { onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import RecordList from '../../components/RecordList.vue'
import { state, businessLabel, loadToday, toast } from '../../domain/pharmacy'
onShow(() => refresh())
async function refresh() { try { await loadToday('accept') } catch (error) { toast(error.message) } }
</script>
