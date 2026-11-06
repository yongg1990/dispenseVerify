<template>
  <view v-if="staticScan.visible" class="modal-mask static-scan-mask" @click="finishStaticScan()" @touchmove.stop.prevent>
    <view class="confirmation-sheet static-scan-sheet" role="dialog" aria-modal="true" :aria-label="staticScan.title" @click.stop>
      <view class="sheet-heading">{{ staticScan.title }}</view>
      <scroll-view scroll-y class="static-scan-list" :style="{ height: `${Math.min(staticScan.items.length * 60, 360)}px` }">
        <button v-for="item in staticScan.items" :key="item.code" class="static-scan-option" @click="finishStaticScan(item.code)">{{ item.name }} · {{ item.code }}</button>
      </scroll-view>
      <button class="static-scan-cancel" @click="finishStaticScan()">取消</button>
    </view>
  </view>
</template>

<script setup>
import { onHide, onUnload } from '@dcloudio/uni-app'
import { staticScan, finishStaticScan } from '../services/scanner'
onHide(() => finishStaticScan())
onUnload(() => finishStaticScan())
</script>

<style scoped>
.static-scan-mask { z-index: 120; }
.static-scan-sheet { display: flex; flex-direction: column; max-height: 85vh; }
.static-scan-sheet .sheet-heading { flex-shrink: 0; line-height: 1.5; }
.static-scan-list { min-height: 0; max-height: 50vh; }
.app-shell .static-scan-option { width: 100%; min-height: 60px; padding: 14px 8px; border-bottom: 1px solid #e4ecee; border-radius: 0; font-size: 13px; overflow-wrap: anywhere; white-space: normal; }
.app-shell .static-scan-cancel { flex-shrink: 0; width: 100%; min-height: 60px; padding: 14px 8px; border-bottom: 1px solid #e4ecee; border-radius: 0; color: #147d72; font-size: 13px; }
</style>
