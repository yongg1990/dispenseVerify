<template>
  <AppShell title="中药房工作台" active="home" @business-change="refresh" @conflict="refresh">
    <HospitalSwitcher @change="refresh" />
    <view class="welcome-row"><view><view class="eyebrow">{{ dateText }} · {{ weekday }}</view><text class="welcome-title">{{ greeting }}，{{ operator.name }}</text></view><view class="shift-badge"><view class="live-dot" />当班中</view></view>
    <view class="overview-band">
      <view class="overview-heading"><text class="overview-label">今日业务概览</text></view>
      <view class="overview-stats">
        <view v-if="can('accept')" class="overview-metric"><text class="overview-number">{{ todayCount('accept') }}</text><text class="overview-unit">已验收 / 条</text></view>
        <view v-if="can('accept') && can('dispense')" class="overview-divider" />
        <view v-if="can('dispense')" class="overview-metric"><text class="overview-number">{{ todayCount('dispense') }}</text><text class="overview-unit">已发药 / 条</text></view>
      </view>
    </view>
    <view class="section-heading"><text>业务办理</text><text class="section-meta">{{ businessLabel }}业务</text></view>
    <view class="home-grid">
      <button v-for="tile in tiles" :key="tile.path" class="home-tile" @click="navigate(tile.path)">
        <view :class="['tile-icon', tile.color]"><AppIcon :name="tile.icon" :size="25" /></view>
        <view class="tile-copy">
          <text class="tile-title">{{ tile.title }}</text>
          <text class="tile-subtitle">{{ tile.subtitle }}</text>
          <view class="tile-stat"><text class="tile-count">{{ tile.count }}</text><text>{{ tile.unit }}</text></view>
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
    <view class="environment-note"><view class="live-dot" /><text>{{ useStaticData ? '静态数据' : '接口模式' }}</text><text class="note-separator">·</text><text>{{ useStaticData ? '演示环境' : '业务状态以服务端为准' }}</text></view>
  </AppShell>
</template>
<script setup>
import { computed } from 'vue'
import { useStaticData } from '../../services/data-source'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'
import HospitalSwitcher from '../../components/HospitalSwitcher.vue'
import { getSession } from '../../services/prescription'
import { canAccessPage } from '../../services/permissions'
import { state, operator, hospital, businessLabel, todayCount, defaultDispenseRows, refreshOverview, navigate, toast, can } from '../../domain/pharmacy'
onShow(() => refresh())
async function refresh() { try { await refreshOverview() } catch (error) { toast(error.message) } }
const now = new Date()
const dateText = `${now.getMonth() + 1}月${now.getDate()}日`
const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]
const greeting = now.getHours() < 12 ? '上午好' : now.getHours() < 18 ? '下午好' : '晚上好'
const awaitingWard = computed(() => state.pendingWardCount ?? '--')
const tiles = computed(() => [
  { path: 'accept', icon: 'package-check', color: 'blue', title: '药包验收', subtitle: '药房药包入库验收', count: state.pendingAcceptanceCount ?? '--', unit: '条待验收' },
  state.business === 'inpatient' ? { path: 'ward-receive', icon: 'clipboard-check', color: 'teal', title: '病区接收', subtitle: '药包扫码 · 病区接收', count: awaitingWard.value, unit: '条待接收' } : { path: 'dispense', icon: 'pill', color: 'teal', title: '患者发药', subtitle: '患者核对 · 药包发放', count: defaultDispenseRows.value.length, unit: '条待发药' },
  ...(state.business === 'inpatient' ? [{ path: 'inpatient-dispense', icon: 'pill', color: 'blue', title: '住院发药', subtitle: '药包核验 · 确认发药', count: defaultDispenseRows.value.length, unit: '条待发药' }, { path: 'receive-records', icon: 'clipboard-check', color: 'teal', title: '接收明细', subtitle: '病区接收操作记录', count: todayCount('receive'), unit: '条今日接收' }] : []),
  { path: 'waybill-accept', icon: 'package', color: 'amber', title: '整单验收', subtitle: '按运单验收药包', count: '', unit: '运单查询' },
  { path: 'accept-records', icon: 'clipboard-list', color: 'amber', title: '验收明细', subtitle: '药包验收操作记录', count: todayCount('accept'), unit: '条今日验收' },
  { path: 'dispense-records', icon: 'file-check-2', color: 'violet', title: '发药明细', subtitle: '患者发药操作记录', count: todayCount('dispense'), unit: '条今日发药' }
].filter(tile => canAccessPage(tile.path, state.business, getSession())))
const recent = computed(() => state.records.filter(r => r.hospitalId === hospital.id && r.business === state.business && r.kind !== 'receive' && can(r.kind)).slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, 3))
</script>

<style scoped>
.app-shell .home-tile { height: 112px; min-height: 112px; flex-direction: row; align-items: center; gap: 10px; padding: 12px; }
.tile-icon { width: 34px; height: 38px; }
.tile-stat { margin-top: 8px; padding-top: 0; gap: 4px; flex-wrap: wrap; }
.tile-count { font-size: 23px; }
.tile-copy { flex: 1; min-width: 0; }
.tile-title { font-size: 15px; }
.tile-subtitle { white-space: normal; overflow-wrap: anywhere; }
.activity-list { border-top: 0; }
.activity-item { padding: 15px 12px; border-bottom: 1px solid #e1e9e8; border-left: 3px solid var(--activity-accent); background: var(--activity-background); }
.activity-accept { --activity-accent: #668bc2; --activity-background: #eff4fb; --activity-title: #436b9b; }
.activity-dispense { --activity-accent: #5d9b80; --activity-background: #edf6f0; --activity-title: #36745a; }
.activity-receive { --activity-accent: #c39a57; --activity-background: #fcf5e9; --activity-title: #946e30; }
.activity-title { color: var(--activity-title); }
.activity-title .activity-person { color: #637a83; }
.activity-subtitle, .activity-time { color: #748891; }
@media (max-width: 360px) {
  .app-shell .home-tile { gap: 7px; padding: 10px; }
  .tile-icon { width: 28px; height: 34px; }
  .tile-title { font-size: 14px; }
}
</style>
