<template><image class="app-icon" :src="`/static/icons/${name}.svg`" mode="aspectFit" :style="{ width: `${size}px`, height: `${size}px` }" /></template>
<script setup>
defineProps({ name: { type: String, default: 'package' }, size: { type: Number, default: 22 } })
</script>
<style scoped>.app-icon { display: inline-block; flex-shrink: 0; vertical-align: middle; }</style>
