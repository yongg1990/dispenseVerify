<template>
  <view v-if="Number(session.orgType) === 1 || compact" :class="['hospital-switcher', { compact }]">
    <text v-if="Number(session.orgType) !== 1" class="hospital-name">{{ session.hospitalName }}</text>
    <picker v-else-if="hospitals.length" class="hospital-picker" :range="hospitals" range-key="label" :value="selectedIndex" :disabled="loading || wardVisible" @change="changeHospital">
      <view class="hospital-choice"><AppIcon v-if="!compact" name="hospital" :size="18" /><text>{{ session.hospitalName }}</text><AppIcon :class="{ 'hospital-arrow': compact }" name="chevron-right" :size="compact ? 12 : 16" /></view>
    </picker>
    <text v-else-if="loading" class="muted">机构加载中…</text>
    <button v-else class="text-button" @click="load">切换机构<AppIcon name="chevron-right" :size="14" /></button>
    <WardDialog :visible="wardVisible" @confirm="confirmWard" @cancel="cancelChange" />
  </view>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import WardDialog from './WardDialog.vue'
import { getSession, saveSession } from '../services/prescription'
import { loadHospitals } from '../services/institutions'
import { state, requestContext, toast } from '../domain/pharmacy'
defineProps({ compact: Boolean })
const emit = defineEmits(['change'])
const session = computed(() => getSession())
const hospitals = ref([])
const loading = ref(false)
const wardVisible = ref(false)
let pendingHospital = null
let loadedToken = ''
const selectedIndex = computed(() => Math.max(0, hospitals.value.findIndex(row => row.hospitalCode === session.value.hospitalCode)))
onMounted(() => { if (Number(session.value.orgType) === 1) load() })
async function load() {
  if (loading.value) return
  loading.value = true
  const current = getSession()
  try {
    const rows = await loadHospitals(current)
    if (getSession().token !== current.token) return
    hospitals.value = rows; loadedToken = current.token
    if (!rows.length) toast('暂无可用机构，请重试')
  } catch (cause) { toast(cause.message) } finally { loading.value = false }
}
function changeHospital(event) {
  const selected = hospitals.value[Number(event.detail.value)]
  if (!selected || selected.hospitalCode === session.value.hospitalCode) return
  pendingHospital = selected
  if (state.business === 'inpatient') { wardVisible.value = true; return }
  applyHospital()
}
function confirmWard(wardName) { applyHospital(wardName) }
function cancelChange() { wardVisible.value = false; pendingHospital = null }
function applyHospital(wardName = '') {
  const current = getSession()
  if (!pendingHospital || current.token !== loadedToken || Number(current.orgType) !== 1) { cancelChange(); return }
  const { hospitalCode, hospitalName } = pendingHospital
  saveSession({ ...current, hospitalCode, hospitalName, wardCode: wardName, wardName })
  requestContext()
  cancelChange()
  emit('change')
}
</script>
<style scoped>
.hospital-switcher { margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--line); font-size: 12px; }
.hospital-choice { display: flex; align-items: center; gap: 8px; min-height: 32px; }
.hospital-choice > text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.hospital-switcher.compact { min-width: 0; margin: 3px 0 0; padding: 0; border: 0; color: var(--muted); font-size: 12px; }
.compact .hospital-choice { justify-content: flex-start; min-height: 24px; gap: 4px; }
.compact .hospital-choice > text { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compact .hospital-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hospital-arrow { flex-shrink: 0; transform: rotate(90deg); }
</style>
