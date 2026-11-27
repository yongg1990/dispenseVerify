<template>
  <view :class="['app-shell', { 'home-shell': active === 'home', 'fixed-content-shell': fixedContent }]">
    <view class="app-header">
      <view class="header-row">
        <button v-if="back" class="icon-button" aria-label="返回工作台" @click="goHome"><AppIcon name="chevron-left" /></button>
        <template v-else><slot name="header-leading"><view class="brand-mark"><AppIcon name="pill" :size="23" /></view></slot></template>
        <view class="header-heading">
          <view class="header-title-row">
            <text class="header-title">{{ title }}</text>
            <view v-if="businessPicker" class="header-business-switch" role="tablist">
              <button v-for="option in businessOptions" :key="option.value" :class="['header-business-option', { active: state.business === option.value }]" role="tab" :aria-selected="state.business === option.value" @click="setBusiness(option.value)">{{ option.label }}</button>
            </view>
          </view>
          <slot name="header-caption"><text class="header-caption">{{ hospital.name }} · {{ hospital.department }}</text></slot>
          <button v-if="state.business === 'inpatient'" class="header-ward-picker" aria-label="切换病区" @click="openWard"><AppIcon name="bed-double" :size="14" /><text>{{ session.wardName || '选择病区' }}</text><AppIcon class="business-arrow" name="chevron-right" :size="12" /></button>
        </view>
        <button v-if="!hideAvatar" class="header-avatar" aria-label="个人中心" @click="open('profile')">{{ operator.name.slice(0, 1) }}</button>
      </view>
      <view v-if="!businessPicker" class="business-switch" role="tablist">
        <button v-if="canUseBusiness('outpatient', session)" :class="['business-option', { active: state.business === 'outpatient' }]" @click="setBusiness('outpatient')"><AppIcon name="hospital" :size="17" />门诊业务</button>
        <button v-if="canUseBusiness('inpatient', session)" :class="['business-option', { active: state.business === 'inpatient' }]" @click="setBusiness('inpatient')"><AppIcon name="bed-double" :size="17" />住院业务</button>
      </view>
    </view>
    <view v-if="pageAllowed" class="page-content"><slot /></view>
    <view class="bottom-nav">
      <button v-for="item in tabs" :key="item.path" :class="['nav-item', { selected: active === item.path }]" @click="open(item.path)"><view class="nav-icon"><AppIcon :name="item.icon" :size="22" /></view><text>{{ item.label }}</text><view v-if="active === item.path" class="nav-dot" /></button>
    </view>
    <StaticScanSheet />
    <WardDialog :visible="wardVisible" :hospital-name="session.hospitalName" :initial-code="session.wardCode || ''" :title="state.business === 'inpatient' ? '切换病区' : '选择病区'" @confirm="confirmWard" @cancel="wardVisible = false" />
  </view>
</template>
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { isLoggedIn, getSession, saveSession } from '../services/prescription'
import { canUseBusiness, canAccessPage, pageForBusiness } from '../services/permissions'
import WardDialog from './WardDialog.vue'
import AppIcon from './AppIcon.vue'
import StaticScanSheet from './StaticScanSheet.vue'
import { state, hospital, operator, switchBusiness, requestContext, can } from '../domain/pharmacy'
requestContext()
const props = defineProps({ title: String, active: { type: String, default: 'home' }, back: Boolean, nursing: Boolean, businessPicker: Boolean, hideAvatar: Boolean, fixedContent: Boolean })
const session = computed(() => getSession())
const businessOptions = computed(() => [
  { value: 'outpatient', label: '门诊业务' },
  { value: 'inpatient', label: '住院业务' }
].filter(item => canUseBusiness(item.value, session.value)))
const wardVisible = ref(false)
let wardSession = null
const pageAllowed = computed(() => canAccessPage(props.active, state.business, session.value))
const emit = defineEmits(['business-change', 'ward-change', 'conflict'])
let visible = true
onShow(() => {
  visible = true
  if (!isLoggedIn()) { uni.reLaunch({ url: '/pages/login/index' }); return }
  if (state.business !== session.value.business) switchBusiness(session.value.business)
  requestContext()
  if (!pageAllowed.value) uni.reLaunch({ url: `/pages/${pageForBusiness(props.active, state.business, session.value)}/index` })
})
onHide(() => { visible = false })
const refreshConflict = () => { if (visible) emit('conflict') }
onMounted(() => uni.$on('pharmacy-conflict', refreshConflict))
onUnmounted(() => uni.$off('pharmacy-conflict', refreshConflict))
const tabs = computed(() => [
  { path: 'home', label: '工作台', icon: 'layout-grid' },
  ...(can('accept') ? [{ path: 'accept', label: '药包验收', icon: 'package-check' }] : []),
  ...(can('dispense') ? [state.business === 'inpatient' ? { path: 'ward-receive', label: '病区接收', icon: 'clipboard-check' } : { path: 'dispense', label: '患者发药', icon: 'pill' }] : []),
  { path: 'profile', label: '我的', icon: 'user-round' }
])
function open(path) { if (path !== props.active && canAccessPage(path, state.business, session.value)) uni.reLaunch({ url: `/pages/${path}/index` }) }
function goHome() { uni.reLaunch({ url: '/pages/home/index' }) }
function setBusiness(value) {
  if (state.business === value) return
  if (!canUseBusiness(value, session.value)) return
  if (value === 'inpatient' && (!session.value.wardCode || !session.value.wardName?.trim())) { openWard(); return }
  switchBusiness(value)
  const target = pageForBusiness(props.active, value, session.value)
  if (target !== props.active) { uni.reLaunch({ url: `/pages/${target}/index` }); return }
  emit('business-change')
}
function openWard() {
  wardSession = getSession()
  wardVisible.value = true
}
function confirmWard({ wardCode, wardName, hospitalName }) {
  const current = getSession()
  wardVisible.value = false
  if (!wardSession || current.token !== wardSession.token || current.hospitalCode !== wardSession.hospitalCode || hospitalName !== current.hospitalName) return
  const changed = wardName !== current.wardName?.trim() || wardCode !== current.wardCode
  if (changed) {
    saveSession({ ...current, wardName, wardCode })
    requestContext()
  }
  if (state.business !== 'inpatient') setBusiness('inpatient')
  else if (changed) emit('ward-change')
}
</script>
<style scoped>
.home-shell .page-content { padding-top: 0; }
.fixed-content-shell { display: flex; flex-direction: column; height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
.fixed-content-shell .app-header { position: relative; flex-shrink: 0; }
.fixed-content-shell .page-content { display: flex; flex: 1; flex-direction: column; min-height: 0; padding: 0; overflow: hidden; }
.fixed-content-shell .bottom-nav { position: static; flex-shrink: 0; width: 100%; transform: none; }
.header-heading { min-width: 0; }
.header-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 10px; }
.header-title { flex-shrink: 0; }
.header-business-switch { display: flex; flex-shrink: 0; gap: 2px; margin-left: auto; padding: 2px; border-radius: 6px; background: #eaeaee; }
.app-shell .header-business-option { min-height: 26px; padding: 3px 7px; border-radius: 4px; color: #666970; font-size: 11px; white-space: nowrap; }
.app-shell .header-business-option.active { background: #fff; color: var(--teal); font-weight: 600; box-shadow: 0 1px 3px #20212414; }
.app-shell .header-ward-picker { justify-content: flex-start; gap: 5px; max-width: 100%; min-height: 32px; border-radius: 0; color: var(--teal); font-size: 12px; text-align: left; }
.header-ward-picker > text { min-width: 0; overflow-wrap: anywhere; }
.business-arrow { transform: rotate(90deg); }
.header-caption { overflow-wrap: anywhere; }
.header-avatar { flex-shrink: 0; }
.app-shell .nav-item { flex: 1; width: auto; }
</style>
