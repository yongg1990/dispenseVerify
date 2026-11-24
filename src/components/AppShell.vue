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
        <button v-if="canUseBusiness('outpatient', session)" :class="['business-option', { active: state.business === 'outpatient' }]" @click="setBusiness('outpatient')"><AppIcon name="hospital" :size="17" />门诊业务</button>
        <button v-if="canUseBusiness('inpatient', session)" :class="['business-option', { active: state.business === 'inpatient' }]" @click="setBusiness('inpatient')"><AppIcon name="bed-double" :size="17" />住院业务</button>
      </view>
    </view>
    <view v-if="pageAllowed" class="page-content"><slot /></view>
    <view class="bottom-nav">
      <button v-for="item in tabs" :key="item.path" :class="['nav-item', { selected: active === item.path }]" @click="open(item.path)"><view class="nav-icon"><AppIcon :name="item.icon" :size="22" /></view><text>{{ item.label }}</text><view v-if="active === item.path" class="nav-dot" /></button>
    </view>
    <StaticScanSheet />
    <WardDialog :visible="wardVisible" @confirm="confirmWard" @cancel="wardVisible = false" />
  </view>
</template>
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { isLoggedIn, getSession, saveSession } from '../services/prescription'
import { canUseBusiness, canAccessPage } from '../services/permissions'
import WardDialog from './WardDialog.vue'
import AppIcon from './AppIcon.vue'
import StaticScanSheet from './StaticScanSheet.vue'
import { state, hospital, currentWard, operator, switchBusiness, requestContext, can } from '../domain/pharmacy'
requestContext()
const props = defineProps({ title: String, active: { type: String, default: 'home' }, back: Boolean, nursing: Boolean })
const session = computed(() => getSession())
const wardVisible = ref(false)
const pageAllowed = computed(() => canAccessPage(props.active, state.business, session.value))
const emit = defineEmits(['business-change', 'conflict'])
let visible = true
onShow(() => {
  visible = true
  if (!isLoggedIn()) { uni.reLaunch({ url: '/pages/login/index' }); return }
  if (state.business !== session.value.business) switchBusiness(session.value.business)
  requestContext()
  if (!pageAllowed.value) uni.reLaunch({ url: '/pages/home/index' })
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
  if (value === 'inpatient' && !session.value.wardName?.trim()) { wardVisible.value = true; return }
  switchBusiness(value)
  if (!canAccessPage(props.active, value, session.value)) { goHome(); return }
  emit('business-change')
}
function confirmWard(wardName) {
  saveSession({ ...getSession(), wardName, wardCode: '' })
  wardVisible.value = false
  setBusiness('inpatient')
}
</script>
<style scoped>
.app-shell .nav-item { flex: 1; width: auto; }
</style>
