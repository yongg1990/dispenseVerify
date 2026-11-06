<template><AppShell title="发药明细" active="records" back nursing @business-change="refresh"><view class="page-heading"><text class="page-title">发药记录</text><text class="muted">{{ businessLabel }}业务</text></view><RecordList :key="state.business" kind="dispense" /></AppShell></template>
<script setup>
import AppShell from '../../components/AppShell.vue'
import RecordList from '../../components/RecordList.vue'
import { onShow } from '@dcloudio/uni-app'
import { state, businessLabel, loadToday, toast } from '../../domain/pharmacy'
onShow(() => refresh())
function refresh() { loadToday('dispense').catch(error => toast(error.message)) }
</script>
