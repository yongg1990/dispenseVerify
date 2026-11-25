<template><button class="scan-panel" @click="$emit('scan')"><view class="scan-symbol"><AppIcon name="scan-line" :size="30" /></view><view class="scan-copy"><text class="scan-title">{{ title }}</text></view><AppIcon name="chevron-right" :size="20" /></button></template>
<script setup>
import AppIcon from './AppIcon.vue'
defineProps({ title: { type: String, default: '扫描药包二维码' }, subtitle: String })
defineEmits(['scan'])
</script>
