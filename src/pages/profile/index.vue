<template>
  <AppShell class="profile-shell" :title="operator.name" active="profile" nursing business-picker hide-avatar>
    <template #header-leading><view class="identity-avatar">{{ operator.name.slice(0, 1) }}</view></template>
    <template #header-caption><view><text v-if="operator.department && operator.department !== '--'" class="profile-caption">{{ operator.department }}</text></view></template>
    <view class="profile-list">
      <view class="profile-row"><text class="profile-label">所属医院</text><text class="profile-value">{{ hospital.name }}</text></view>
      <view class="profile-row"><text class="profile-label">医院编码</text><text class="profile-value identifier">{{ hospital.id || '--' }}</text></view>
    </view>
    <view class="profile-list action-list">
      <button class="profile-row profile-action" @click="showAccount"><AppIcon name="user-round" :size="20" /><text class="grow">账号信息</text><AppIcon name="chevron-right" :size="17" /></button>
      <button class="profile-row profile-action" @click="showAbout"><AppIcon name="pill" :size="20" /><text class="grow">关于</text><AppIcon name="chevron-right" :size="17" /></button>
    </view>
    <button class="secondary-button card-action logout-button" :disabled="loggingOut" @click="logout">{{ loggingOut ? '退出中' : '退出登录' }}</button>
  </AppShell>
</template>
<script setup>
import { useStaticData } from '../../services/data-source'
import { ref } from 'vue'
import { logoutUser } from '../../services/auth'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import { operator, hospital, toast } from '../../domain/pharmacy'
const loggingOut = ref(false)
function showAccount() {
  const id = String(operator.value.id || '--')
  const canCopy = id !== '--'
  uni.showModal({
    title: '账号信息',
    content: `${operator.value.name}\n用户编号：${id}`,
    showCancel: canCopy,
    cancelText: '关闭',
    confirmText: canCopy ? '复制编号' : '关闭',
    success: result => {
      if (!result.confirm || !canCopy) return
      uni.setClipboardData({ data: id, showToast: false, success: () => toast('编号已复制'), fail: () => toast('复制失败，请重试') })
    }
  })
}
function showAbout() {
  uni.showModal({
    title: '中药房工作台',
    content: `版本 v0.1.0\n运行环境：${useStaticData ? '静态数据' : '接口模式'}\nHIS / 短信：${useStaticData ? '未连接' : '由服务端处理'}`,
    showCancel: false,
    confirmText: '关闭'
  })
}
async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try { await logoutUser() } catch (error) { toast(error.message) } finally { loggingOut.value = false }
}
</script>

<style scoped>
.profile-shell :deep(.app-header) { padding-top: calc(20px + env(safe-area-inset-top)); padding-bottom: 20px; }
.profile-shell :deep(.header-title-row) { justify-content: space-between; gap: 8px 16px; }
.profile-shell :deep(.header-title) { flex-shrink: 1; min-width: 0; font-size: 18px; overflow-wrap: anywhere; }
.identity-avatar { display: flex; flex: 0 0 48px; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: #edf3f1; color: var(--teal); font-size: 20px; font-weight: 500; }
.profile-caption { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
.profile-list { margin: 0 calc(0px - var(--gutter)); padding: 0 var(--gutter); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: #fff; }
.action-list { margin-top: 20px; }
.profile-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 58px; padding: 16px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
.profile-row:last-child { border-bottom: 0; }
.profile-label { flex: 0 0 72px; color: var(--muted); white-space: nowrap; }
.profile-value { min-width: 0; color: var(--ink); text-align: right; overflow-wrap: anywhere; line-height: 1.6; }
.identifier { font-variant-numeric: tabular-nums; }
.app-shell .profile-action { width: 100%; min-height: 56px; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--line); border-radius: 0; color: var(--ink); font-size: 14px; text-align: left; }
.app-shell .profile-action:last-child { border-bottom: 0; }
.profile-action .app-icon { opacity: .5; }.profile-action .app-icon:last-child { opacity: .3; }
.app-shell .logout-button { width: calc(100% + var(--gutter) + var(--gutter)); min-height: 52px; margin: 28px calc(0px - var(--gutter)) 0; border: 1px solid var(--line); border-left: 0; border-right: 0; border-radius: 0; background: #fff; color: #c44343; font-size: 14px; font-weight: 500; }
</style>
