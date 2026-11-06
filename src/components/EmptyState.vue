<template><view class="empty-state"><view class="empty-icon"><AppIcon :name="icon" :size="31" /></view><text class="empty-title">{{ title }}</text><text v-if="subtitle" class="empty-subtitle">{{ subtitle }}</text></view></template>
<script setup>
import AppIcon from './AppIcon.vue'
defineProps({ title: String, subtitle: String, icon: { type: String, default: 'clipboard-list' } })
</script>
