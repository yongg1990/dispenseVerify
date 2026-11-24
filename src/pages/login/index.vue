<template>
  <view class="app-shell login-page">
    <view class="login-brand"><view class="brand-mark"><AppIcon name="pill" :size="25" /></view><text class="login-title">中药房工作台</text><text class="login-caption">药包验收 · 患者发药 · 病区接收</text></view>
    <view class="login-form">
      <view class="login-field"><text><text class="required-mark">*</text>账号</text><view class="search-field"><AppIcon name="user-round" :size="19" /><input v-model="loginName" :disabled="busy" :maxlength="-1" placeholder="请输入登录账号" /></view></view>
      <view class="login-field"><text><text class="required-mark">*</text>密码</text><view class="search-field"><AppIcon name="shield-check" :size="19" /><input v-model="password" :disabled="busy" :maxlength="-1" password placeholder="请输入密码" confirm-type="done" @confirm="login" /></view></view>
      <button class="primary-button card-action" :disabled="busy || hospitalVisible || wardVisible || !canSubmit" @click="login"><AppIcon name="shield-check" :size="19" />{{ busy ? '登录中' : '登录工作台' }}</button>
    </view>
    <view v-if="hospitalVisible" class="modal-mask hospital-mask">
      <view class="hospital-dialog" role="dialog" aria-modal="true" aria-label="医疗机构">
        <view class="hospital-heading"><view class="tile-icon teal"><AppIcon name="hospital" :size="23" /></view><text>医疗机构</text></view>
        <text v-if="hospitalLoading" class="hospital-empty">正在获取所属医疗机构…</text>
        <view v-if="hospitalFailed" class="sheet-actions"><button class="secondary-button" :disabled="hospitalLoading || leaving" @click="restartLogin">{{ leaving ? '退出中' : '重新登录' }}</button><button class="primary-button" :disabled="hospitalLoading || leaving" @click="completeLogin">重试</button></view>
      </view>
    </view>
    <WardDialog :visible="wardVisible" cancel-text="重新登录" @confirm="confirmWard" @cancel="restartLogin" />
  </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import WardDialog from '../../components/WardDialog.vue'
import { getSession, saveSession, isLoggedIn, consumeLoginError } from '../../services/prescription'
import { loginWithPassword, logoutUser } from '../../services/auth'
import { selectDefaultHospital } from '../../services/institutions'
import { canUseBusiness } from '../../services/permissions'
import { switchBusiness, toast } from '../../domain/pharmacy'
const loginName = ref('')
const password = ref('')
const busy = ref(false)
const hospitalVisible = ref(false)
const hospitalLoading = ref(false)
const hospitalFailed = ref(false)
const wardVisible = ref(false)
const leaving = ref(false)
const canSubmit = computed(() => loginName.value.trim() && password.value)
onShow(() => {
  if (isLoggedIn()) { uni.reLaunch({ url: '/pages/home/index' }); return }
  const session = getSession()
  if (session.token) {
    completeLogin()
    return
  }
  hospitalVisible.value = false; wardVisible.value = false
  const message = consumeLoginError()
  if (message) toast(message)
})
async function completeLogin() {
  if (hospitalLoading.value || leaving.value) return
  hospitalLoading.value = true; hospitalVisible.value = true; hospitalFailed.value = false
  const session = getSession()
  try {
    if (session.hospitalSelectionRequired || !session.hospitalCode) await selectDefaultHospital(session)
    if (getSession().token !== session.token) return
    hospitalVisible.value = false
    const current = getSession()
    if (!canUseBusiness('outpatient', current) && canUseBusiness('inpatient', current) && !current.wardName?.trim()) {
      wardVisible.value = true
    } else enterHome()
  } catch (error) { hospitalFailed.value = true; toast(error.message) } finally { hospitalLoading.value = false }
}
function confirmWard(wardName) {
  const session = getSession()
  if (!session.token) return
  saveSession({ ...session, wardName, wardCode: '' })
  wardVisible.value = false
  enterHome()
}
function enterHome() {
  switchBusiness(getSession().business)
  uni.reLaunch({ url: '/pages/home/index' })
}
async function restartLogin() {
  if (leaving.value || hospitalLoading.value) return
  leaving.value = true
  try { await logoutUser() } catch (error) { toast(error.message) }
  finally { hospitalVisible.value = false; wardVisible.value = false; leaving.value = false }
}
async function login() {
  if (busy.value || hospitalVisible.value || wardVisible.value || !canSubmit.value) return
  busy.value = true
  try {
    const result = await loginWithPassword(loginName.value, password.value, { accountName: loginName.value.trim() })
    password.value = ''
    if (typeof result.PWDExpirationMsg === 'string' && result.PWDExpirationMsg.trim()) {
      toast(result.PWDExpirationMsg)
    }
    await completeLogin()
  } catch (error) { toast(error.message) } finally { busy.value = false }
}
</script>
<style scoped>
.login-page { padding: calc(48px + env(safe-area-inset-top)) 28px 40px; }
.login-brand { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 12px 0 36px; border-bottom: 1px solid var(--line); }
.login-title { font-size: 25px; font-weight: 650; }
.login-caption { color: var(--muted); font-size: 12px; text-align: center; }
.login-form { padding-top: 28px; }
.login-field { margin-top: 18px; display: flex; flex-direction: column; gap: 8px; }
.login-field > text { font-size: 12px; color: #637e80; }
.required-mark { color: #d93025; margin-right: 4px; }
.hospital-mask { align-items: center; padding: 20px; }
.hospital-dialog { width: 100%; max-width: 420px; max-height: 85vh; overflow-y: auto; padding: 22px; border-radius: 8px; background: #fff; }
.hospital-heading { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 600; }
.hospital-empty { display: block; margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.6; }
</style>
