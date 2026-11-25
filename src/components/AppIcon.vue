<template><image class="app-icon" :src="iconSrc" mode="aspectFit" :style="{ width: `${size}px`, height: `${size}px` }" /></template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ name: { type: String, default: 'package' }, size: { type: Number, default: 22 } })
const icons = import.meta.glob('../static/icons/*.svg', { eager: true, query: '?url', import: 'default' })
const iconSrc = computed(() => icons[`../static/icons/${props.name}.svg`])
</script>
<style scoped>.app-icon { display: inline-block; flex-shrink: 0; vertical-align: middle; }</style>
