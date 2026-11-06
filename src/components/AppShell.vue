<template>
  <view class="app-shell">
    <view class="app-header">
      <view class="header-row">
        <button v-if="back" class="icon-button" aria-label="返回工作台" @click="goHome"><AppIcon name="chevron-left" /></button>
        <view v-else class="brand-mark"><AppIcon name="pill" :size="23" /></view>
        <view class="header-heading"><text class="header-title">{{ title }}</text><text class="header-caption">{{ hospital.name }} · {{ state.business === 'inpatient' && nursing ? currentWard.station : hospital.department }}</text></view>
        <view class="header-avatar">{{ operator.name.slice(0, 1) }}</view>
      </view>
      <view class="business-switch" role="tablist">
        <button :class="['business-option', { active: state.business === 'outpatient' }]" @click="setBusiness('outpatient')"><AppIcon name="hospital" :size="17" />门诊业务</button>
        <button :class="['business-option', { active: state.business === 'inpatient' }]" @click="setBusiness('inpatient')"><AppIcon name="bed-double" :size="17" />住院业务</button>
      </view>
    </view>
    <view class="page-content"><slot /></view>
    <view class="bottom-nav">
      <button v-for="item in tabs" :key="item.path" :class="['nav-item', { selected: active === item.path }]" @click="open(item.path)"><view class="nav-icon"><AppIcon :name="item.icon" :size="22" /></view><text>{{ item.label }}</text><view v-if="active === item.path" class="nav-dot" /></button>
    </view>
    <StaticScanSheet />
  </view>
</template>
<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import StaticScanSheet from './StaticScanSheet.vue'
import { state, hospital, currentWard, operator, switchBusiness, requestContext } from '../domain/pharmacy'
requestContext()
const props = defineProps({ title: String, active: { type: String, default: 'home' }, back: Boolean, nursing: Boolean })
const emit = defineEmits(['business-change'])
const tabs = computed(() => [{ path: 'home', label: '工作台', icon: 'layout-grid' }, { path: 'accept', label: '药包验收', icon: 'package-check' }, state.business === 'inpatient' ? { path: 'ward-receive', label: '病区接收', icon: 'clipboard-check' } : { path: 'dispense', label: '患者发药', icon: 'pill' }, { path: 'profile', label: '我的', icon: 'user-round' }])
function open(path) { if (path !== props.active) uni.reLaunch({ url: `/pages/${path}/index` }) }
function goHome() { uni.reLaunch({ url: '/pages/home/index' }) }
function setBusiness(value) {
  if (state.business === value) return
  switchBusiness(value); emit('business-change')
  if (['dispense', 'ward-receive'].includes(props.active)) uni.reLaunch({ url: `/pages/${value === 'inpatient' ? 'ward-receive' : 'dispense'}/index` })
}
</script>
