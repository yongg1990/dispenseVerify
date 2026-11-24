<template><view class="empty-state" :aria-label="title || '暂无数据'"><view class="empty-icon"><AppIcon :name="icon" :size="31" /></view><text v-if="!iconOnly && title" class="empty-title">{{ title }}</text><text v-if="!iconOnly && subtitle" class="empty-subtitle">{{ subtitle }}</text></view></template>
<script setup>
import AppIcon from './AppIcon.vue'
defineProps({ title: String, subtitle: String, iconOnly: Boolean, icon: { type: String, default: 'clipboard-list' } })
</script>
