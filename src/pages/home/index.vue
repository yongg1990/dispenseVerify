<template>
  <AppShell class="home-page" title="工作台" active="home" business-picker @business-change="refresh" @ward-change="refresh" @conflict="refresh">
    <template #header-caption><HospitalSwitcher compact @change="refreshHospital" /></template>
    <view class="home-overview">
      <view class="today-label"><text>{{ dateText }}</text><text class="today-weekday">{{ weekday }}</text></view>
      <view v-if="can('accept')" class="today-metric"><text class="today-number">{{ todayCount('accept') }}</text><text>已验收</text></view>
      <view v-if="can('dispense')" class="today-metric"><text class="today-number">{{ todayCount('dispense') }}</text><text>已发药</text></view>
    </view>
    <view class="home-content">
    <view class="section-heading"><text>业务办理</text><text class="section-meta">{{ businessLabel }}业务</text></view>
    <view class="operation-grid">
      <button v-for="tile in visibleTiles" :key="tile.path" class="operation-card" @click="navigate(tile.path)">
        <view :class="['tile-icon', tile.color]"><AppIcon :name="tile.icon" :size="23" /></view>
        <view class="operation-copy">
          <text class="operation-title">{{ tile.title }}</text>
          <text class="operation-subtitle">{{ tile.subtitle }}</text>
          <view class="operation-stat"><text v-if="tile.count !== ''" class="operation-count">{{ tile.count }}</text><text class="operation-unit">{{ tile.unit }}</text></view>
        </view>
      </button>
    </view>
    <view class="section-heading recent-heading"><text>最近操作</text><button class="text-button" @click="navigate(can('dispense') ? 'dispense-records' : 'accept-records')">查看全部<AppIcon name="chevron-right" :size="14" /></button></view>
    <view class="activity-list">
      <view v-for="record in recent" :key="record.entryId" :class="['activity-item', `activity-${record.kind}`]">
        <view :class="['activity-icon', record.kind === 'accept' ? 'blue' : record.kind === 'receive' ? 'amber' : 'teal']"><AppIcon :name="record.kind === 'accept' ? 'package-check' : record.kind === 'receive' ? 'clipboard-check' : 'pill'" :size="19" /></view>
        <view class="grow"><view class="activity-title">{{ record.kind === 'accept' ? '药包验收' : record.kind === 'receive' ? '病区接收' : '患者发药' }}<text class="activity-person">{{ record.name }}</text></view><text class="activity-subtitle">{{ record.operator }} · 批次 {{ record.batch }}</text></view>
        <text class="activity-time">{{ record.time.slice(11, 16) }}</text>
      </view>
    </view>
    <EmptyState v-if="!recent.length" icon-only title="暂无最近操作" />
    </view>
  </AppShell>
</template>
<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'
import HospitalSwitcher from '../../components/HospitalSwitcher.vue'
import { getSession } from '../../services/prescription'
import { canAccessPage } from '../../services/permissions'
import { state, hospital, businessLabel, todayCount, defaultDispenseRows, refreshOverview, navigate, toast, can } from '../../domain/pharmacy'
const now = ref(new Date())
const dateText = computed(() => `${now.value.getMonth() + 1}月${now.value.getDate()}日`)
const weekday = computed(() => ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.value.getDay()])
onShow(() => { now.value = new Date(); refresh() })
async function refresh() { try { await refreshOverview() } catch (error) { toast(error.message) } }
const changingHospital = ref(false)
async function refreshHospital() {
  if (changingHospital.value) return
  changingHospital.value = true
  uni.showLoading({ title: '切换机构中', mask: true })
  let failure
  try { await refreshOverview() } catch (error) { failure = error }
  finally { changingHospital.value = false; uni.hideLoading() }
  if (failure) toast(failure.message)
}
const awaitingWard = computed(() => state.pendingWardCount ?? '--')
const tiles = computed(() => [
  { path: 'accept', icon: 'package-check', color: 'blue', title: '药包验收', subtitle: '药房药包入库验收', count: state.pendingAcceptanceCount ?? '--', unit: '条待验收' },
  state.business === 'inpatient' ? { path: 'ward-receive', icon: 'clipboard-check', color: 'teal', title: '病区接收', subtitle: '药包扫码 · 病区接收', count: awaitingWard.value, unit: '条待接收' } : { path: 'dispense', icon: 'pill', color: 'teal', title: '患者发药', subtitle: '患者核对 · 药包发放', count: defaultDispenseRows.value.length, unit: '条待发药' },
  ...(state.business === 'inpatient' ? [{ path: 'inpatient-dispense', icon: 'pill', color: 'blue', title: '住院发药', subtitle: '药包核验 · 确认发药', count: defaultDispenseRows.value.length, unit: '条待发药' }, { path: 'receive-records', icon: 'clipboard-check', color: 'teal', title: '接收明细', subtitle: '病区接收操作记录', count: todayCount('receive'), unit: '条今日接收' }] : []),
  { path: 'waybill-accept', icon: 'package', color: 'amber', title: '整单验收', subtitle: '按运单验收药包', count: '', unit: '运单查询' },
  { path: 'accept-records', icon: 'clipboard-list', color: 'amber', title: '验收明细', subtitle: '药包验收操作记录', count: todayCount('accept'), unit: '条今日验收' },
  { path: 'dispense-records', icon: 'file-check-2', color: 'violet', title: '发药明细', subtitle: '患者发药操作记录', count: todayCount('dispense'), unit: '条今日发药' }
].filter(tile => canAccessPage(tile.path, state.business, getSession())))
const visibleTiles = computed(() => tiles.value.filter(tile => tile.path !== 'waybill-accept'))
const recent = computed(() => state.records.filter(r => r.hospitalId === hospital.id && r.business === state.business && r.kind !== 'receive' && can(r.kind)).slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, 3))
</script>

<style scoped>
.home-page { background: #f4f7f8; }
.home-overview { display: flex; align-items: center; gap: 18px; min-height: 90px; margin: 0 calc(0px - var(--gutter)); padding: 18px var(--gutter); border-bottom: 1px solid var(--line); background: #fff; }
.today-label { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; font-size: 15px; font-weight: 600; }
.today-weekday { color: var(--muted); font-size: 12px; font-weight: 400; }
.today-metric { display: flex; flex: 1; min-width: 0; align-items: flex-start; flex-direction: column; gap: 3px; padding-left: 18px; border-left: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.today-number { color: var(--ink); font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.2; overflow-wrap: anywhere; }
.home-content { padding-top: 24px; color: #24424f; }
.section-meta { color: #8395a1; font-size: 11px; }
.operation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.app-shell .operation-card { width: 100%; min-height: 112px; justify-content: flex-start; gap: 10px; padding: 16px 12px; border: 1px solid #dce6eb; border-radius: 8px; background: #fff; text-align: left; }
.tile-icon { width: 34px; height: 38px; border-radius: 7px; }
.operation-copy { flex: 1; min-width: 0; }
.operation-title { display: block; color: #24424f; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.operation-subtitle { display: block; margin-top: 4px; color: #8395a1; font-size: 11px; overflow-wrap: anywhere; }
.operation-stat { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.operation-count { min-width: 0; color: #315760; font-size: 22px; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.operation-unit { color: #8395a1; font-size: 11px; overflow-wrap: anywhere; }
.recent-heading { margin-top: 28px; }
.app-shell .recent-heading .text-button { color: #8395a1; font-size: 11px; }
.activity-list { margin: 0; padding: 0; border: 0; background: transparent; }
.activity-item { min-height: 70px; gap: 12px; padding: 12px; border-bottom: 1px solid #dce6eb; border-left: 3px solid #5ca88c; background: #ebf6f0; }
.activity-item:last-child { border-bottom: 1px solid #dce6eb; }
.activity-accept { border-left-color: #658bc8; background: #eff4fc; }
.activity-receive { border-left-color: #d1a05a; background: #fbf4e9; }
.activity-title { color: #147d73; font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
.activity-accept .activity-title { color: #436b9b; }
.activity-receive .activity-title { color: #9a743d; }
.activity-person { margin-left: 10px; color: #526e7b; font-size: 12px; }
.activity-subtitle { margin-top: 4px; color: #8395a1; font-size: 11px; }
.activity-time { color: #6686a3; font-size: 10px; }
@media (max-width: 360px) {
  .home-overview { gap: 12px; }
  .today-metric { padding-left: 12px; }
  .operation-grid { gap: 10px; }
  .app-shell .operation-card { gap: 8px; padding: 14px 10px; }
  .tile-icon { width: 30px; height: 34px; }
  .operation-title { font-size: 14px; }
}
</style>
