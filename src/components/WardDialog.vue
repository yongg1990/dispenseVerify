<template>
  <view v-if="visible" class="modal-mask ward-mask">
    <view class="ward-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <view class="sheet-heading"><text>{{ title }}</text></view>
      <text v-if="loading" class="ward-status">加载中…</text>
      <view v-else-if="loadError || !tree.length" class="ward-empty"><text class="ward-status">{{ loadError || '暂无可用病区' }}</text><button class="text-button" @click="load">重试<AppIcon name="refresh-cw" :size="16" /></button></view>
      <UniDataPicker v-else v-model="selectedCode" :localdata="tree" :clear-icon="false" popup-title="选择病区">
        <view class="ward-choice" role="button" aria-label="选择病区"><AppIcon name="bed-double" :size="18" /><text :class="{ muted: !selectedWard }">{{ selectedWard?.text || '请选择病区' }}</text><AppIcon class="ward-arrow" name="chevron-right" :size="16" /></view>
      </UniDataPicker>
      <view class="sheet-actions"><button class="secondary-button" @click="$emit('cancel')">{{ cancelText }}</button><button class="primary-button" :disabled="loading || !selectedWard" @click="confirm">确认</button></view>
    </view>
  </view>
</template>
<script setup>
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import UniDataPicker from '@dcloudio/uni-ui/lib/uni-data-picker/uni-data-picker.vue'
import AppIcon from './AppIcon.vue'
import { getSession } from '../services/prescription'
import { loadWardOptions } from '../services/departments'
const props = defineProps({
  visible: Boolean, cancelText: { type: String, default: '取消' }, title: { type: String, default: '选择病区' },
  hospitalName: { type: String, default: '' }, initialCode: { type: String, default: '' }
})
const emit = defineEmits(['confirm', 'cancel'])
const tree = ref([])
const leaves = shallowRef(new Map())
const selectedCode = ref('')
const selectedWard = computed(() => leaves.value.get(selectedCode.value))
const loading = ref(false)
const loadError = ref('')
let loadVersion = 0
let loadedSession = null
let loadedHospitalName = ''
watch(() => [props.visible, props.hospitalName], ([visible]) => {
  if (visible) load()
  else { loadVersion++; loadedSession = null }
}, { immediate: true })
onUnmounted(() => { loadVersion++ })
async function load() {
  const version = ++loadVersion
  const session = getSession()
  const hospitalName = props.hospitalName || session.hospitalName
  loading.value = true; loadError.value = ''; selectedCode.value = ''
  tree.value = []; leaves.value = new Map(); loadedSession = null
  try {
    const options = await loadWardOptions(hospitalName, session)
    if (version !== loadVersion || !props.visible) return
    tree.value = options.tree; leaves.value = options.leaves
    loadedSession = session; loadedHospitalName = hospitalName
    if (options.leaves.has(props.initialCode)) selectedCode.value = props.initialCode
  } catch (error) {
    if (version === loadVersion) loadError.value = error.message
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
function confirm() {
  const ward = selectedWard.value
  const current = getSession()
  if (!ward || !loadedSession || current.token !== loadedSession.token || current.hospitalCode !== loadedSession.hospitalCode) return
  emit('confirm', { wardCode: ward.value, wardName: ward.text, hospitalName: loadedHospitalName })
}
</script>
<style scoped>
.ward-mask { align-items: center; padding: 20px; }
.ward-dialog { width: 100%; max-width: 380px; padding: 24px; border-radius: 8px; background: #fff; }
.ward-choice { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; }
.ward-choice > text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.ward-choice > .app-icon { flex-shrink: 0; opacity: .5; }
.ward-arrow { transform: rotate(90deg); }
.ward-status { display: block; color: var(--muted); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.ward-empty { display: flex; align-items: center; gap: 12px; }
.ward-empty > text { flex: 1; min-width: 0; }
.ward-empty > button { flex-shrink: 0; }
</style>
