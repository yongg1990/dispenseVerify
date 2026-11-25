<template>
  <view v-if="visible" class="modal-mask ward-mask">
    <view class="ward-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <view class="sheet-heading"><text>{{ title }}</text></view>
      <view class="search-field"><AppIcon name="bed-double" :size="18" /><input v-model="name" :maxlength="100" placeholder="请输入病区名称" confirm-type="done" @confirm="confirm" /></view>
      <view class="sheet-actions"><button class="secondary-button" @click="$emit('cancel')">{{ cancelText }}</button><button class="primary-button" :disabled="!name.trim()" @click="confirm">确认</button></view>
    </view>
  </view>
</template>
<script setup>
import { ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
const props = defineProps({ visible: Boolean, cancelText: { type: String, default: '取消' }, title: { type: String, default: '填写病区名称' }, initialName: { type: String, default: '' } })
const emit = defineEmits(['confirm', 'cancel'])
const name = ref('')
watch(() => props.visible, visible => { if (visible) name.value = props.initialName })
function confirm() { if (name.value.trim()) emit('confirm', name.value.trim()) }
</script>
<style scoped>
.ward-mask { align-items: center; padding: 20px; }
.ward-dialog { width: 100%; max-width: 380px; padding: 24px; border-radius: 8px; background: #fff; }
</style>
