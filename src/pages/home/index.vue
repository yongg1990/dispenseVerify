<template>
  <AppShell title="工作台" active="home" business-picker @business-change="refresh" @ward-change="refresh" @conflict="refresh">
    <template #header-caption><HospitalSwitcher compact @change="refreshHospital" /></template>
    <view class="home-overview">
      <view class="today-label"><text>{{ dateText }}</text><text class="today-weekday">{{ weekday }}</text></view>
      <view v-if="can('accept')" class="today-metric"><text class="today-number">{{ todayCount('accept') }}</text><text>已验收</text></view>
      <view v-if="can('dispense')" class="today-metric"><text class="today-number">{{ todayCount('dispense') }}</text><text>已发药</text></view>
    </view>
    <view class="section-heading"><text>业务办理</text></view>
    <view class="operation-list">
      <button v-for="tile in operationTiles" :key="tile.path" :class="['operation-row', `operation-${tile.color}`]" @click="navigate(tile.path)">
        <view :class="['tile-icon', tile.color]"><AppIcon :name="tile.icon" :size="23" /></view>
        <text class="grow operation-title">{{ tile.title }}</text>
        <view class="operation-stat"><text v-if="tile.count !== ''" class="operation-count">{{ tile.count }}</text><text>{{ tile.unit }}</text></view>
        <AppIcon name="chevron-right" :size="16" />
      </button>
    </view>
    <view class="section-heading"><text>业务明细</text></view>
    <view class="entry-list">
      <button v-for="tile in recordTiles" :key="tile.path" class="entry-row" @click="navigate(tile.path)"><AppIcon :name="tile.icon" :size="20" /><text class="grow">{{ tile.title }}</text><text class="entry-count">{{ tile.count }}</text><AppIcon name="chevron-right" :size="16" /></button>
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
import { state, hospital, todayCount, defaultDispenseRows, refreshOverview, navigate, toast, can } from '../../domain/pharmacy'
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
const operationTiles = computed(() => tiles.value.filter(tile => !tile.path.endsWith('-records')))
const recordTiles = computed(() => tiles.value.filter(tile => tile.path.endsWith('-records')))
const recent = computed(() => state.records.filter(r => r.hospitalId === hospital.id && r.business === state.business && r.kind !== 'receive' && can(r.kind)).slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, 3))
</script>

<style scoped>
.home-overview { display: flex; align-items: center; gap: 18px; min-height: 90px; margin: 0 calc(0px - var(--gutter)); padding: 18px var(--gutter); border-bottom: 1px solid var(--line); background: #fff; }
.today-label { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; font-size: 15px; font-weight: 600; }
.today-weekday { color: var(--muted); font-size: 12px; font-weight: 400; }
.today-metric { display: flex; flex: 1; min-width: 0; align-items: flex-start; flex-direction: column; gap: 3px; padding-left: 18px; border-left: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.today-number { color: var(--ink); font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.2; overflow-wrap: anywhere; }
.operation-list { display: flex; flex-direction: column; gap: 12px; margin: 0 calc(0px - var(--gutter)); }
.app-shell .operation-row { width: 100%; min-height: 78px; justify-content: flex-start; gap: 12px; padding: 18px var(--gutter); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); border-radius: 0; background: #fff; text-align: left; }
.app-shell .operation-blue { background: #eff4fd; border-color: #e2eaf6; }
.app-shell .operation-teal { background: #edf7f3; border-color: #dfede7; }
.app-shell .operation-amber { background: #fff7ec; border-color: #f3e8d8; }
.operation-row > .app-icon { opacity: .3; }
.tile-icon { width: 36px; height: 36px; }
.operation-title { font-size: 16px; font-weight: 500; overflow-wrap: anywhere; }
.operation-stat { display: flex; align-items: baseline; justify-content: flex-end; flex-wrap: wrap; gap: 4px; max-width: 42%; color: var(--muted); font-size: 12px; text-align: right; overflow-wrap: anywhere; }
.operation-count { color: var(--ink); font-size: 18px; font-weight: 500; font-variant-numeric: tabular-nums; }
.entry-list { margin: 0 calc(0px - var(--gutter)); padding: 0 var(--gutter); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: #fff; }
.app-shell .entry-row { width: 100%; min-height: 57px; justify-content: flex-start; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--line); border-radius: 0; text-align: left; }.app-shell .entry-row:last-child { border-bottom: 0; }.entry-row > .app-icon { opacity: .5; }.entry-row > .app-icon:last-child { opacity: .3; }.entry-count { color: var(--muted); font-size: 13px; }
@media (max-width: 360px) { .home-overview { gap: 12px; }.today-metric { padding-left: 12px; }.app-shell .operation-row { gap: 10px; } }
</style>
