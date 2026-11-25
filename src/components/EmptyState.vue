<template><view class="empty-state" :aria-label="title || '暂无数据'"><view class="empty-icon"><AppIcon :name="icon" :size="30" /></view><text v-if="title" class="empty-title">{{ title }}</text></view></template>
<script setup>
import AppIcon from './AppIcon.vue'
defineProps({ title: String, subtitle: String, iconOnly: Boolean, icon: { type: String, default: 'clipboard-list' } })
</script>
