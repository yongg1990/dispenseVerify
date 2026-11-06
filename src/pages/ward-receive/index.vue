<template>
  <AppShell title="病区接收" active="ward-receive" back nursing @business-change="reset">
    <template v-if="state.business === 'inpatient'">
      <view class="page-heading"><text class="page-title">{{ currentWard.station }}</text><text class="muted">{{ operator.name }}</text></view>
      <ScanPanel title="扫描药包二维码" subtitle="住院药包 · 病区接收" @scan="scan" />
      <view class="input-action"><view class="search-field"><AppIcon name="scan-line" :size="18" /><input v-model="code" placeholder="输入药包二维码" confirm-type="search" @confirm="lookup" /></view><button class="primary-button compact" @click="lookup">加载</button></view>
      <PrescriptionCard v-if="selected" :row="selected"><view class="success-inline"><AppIcon name="shield-check" :size="17" />{{ selected.wardName || currentWard.name }} · 病区核验一致</view><button class="primary-button card-action" :disabled="selected.status === 'dispensed' || submitting" @click="confirm">{{ selected.status === 'dispensed' ? '已发药' : submitting ? '提交中' : '确认发药' }}</button></PrescriptionCard>
      <view class="section-heading"><text>待接收药包</text><text class="section-meta">{{ pending.length }} 个</text></view>
      <view class="compact-record" v-for="row in pending" :key="row.id"><view class="activity-icon teal"><AppIcon name="package" :size="18" /></view><view class="grow"><text class="row-title">{{ row.name }} · {{ row.bed }} 床</text><text class="row-subtitle">{{ row.packageCode }}</text></view><text class="small muted">待扫码</text></view>
      <EmptyState v-if="!pending.length" title="暂无待接收药包" />
      <view class="section-heading"><text>今日住院发药</text><text class="section-meta">{{ todayCount('dispense') }} 条</text></view>
      <view class="compact-record" v-for="r in dispensed" :key="r.entryId"><view class="grow"><text class="row-title">{{ r.name }} · {{ r.no }}</text><text class="row-subtitle">{{ r.operator }} · {{ r.time }}</text></view><text class="way-tag">已发药</text></view>
    </template>
    <EmptyState v-else icon="bed-double" title="病区接收仅适用于住院业务" subtitle="请选择顶部住院业务" />
  </AppShell>
</template>
<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import ScanPanel from '../../components/ScanPanel.vue'
import PrescriptionCard from '../../components/PrescriptionCard.vue'
import EmptyState from '../../components/EmptyState.vue'
import { state, operator, currentWard, loadWardPending, findWardPackage, dispensePackage, loadToday, refreshRequests, todayRecords, todayCount, toast } from '../../domain/pharmacy'
import { scanCode } from '../../services/scanner'
const code = ref(''); const selected = ref(null); const submitting = ref(false); const loading = ref(false)
const pending = computed(() => state.wardRows)
const dispensed = computed(() => todayRecords('dispense'))
onShow(() => refresh())
async function refresh() {
  if (state.business !== 'inpatient') return
  try { await refreshRequests([() => loadWardPending(), () => loadToday('dispense')]) } catch (error) { toast(error.message) }
}
function reset() { code.value = ''; selected.value = null; refresh() }
async function lookup() {
  if (loading.value || submitting.value) return
  selected.value = null; loading.value = true
  try { selected.value = await findWardPackage(code.value); code.value = '' } catch (error) { toast(error.message) } finally { loading.value = false }
}
async function scan() { try { code.value = await scanCode({ type: 'package', business: state.business }); await lookup() } catch (error) { toast(error.message) } }
async function confirm() {
  if (!selected.value || submitting.value) return
  const row = selected.value; submitting.value = true
  try {
    const result = await dispensePackage(row)
    Object.assign(row, result, { status: 'dispensed' })
    toast(result.alreadyDispensed ? '该处方此前已发药' : '发药成功')
    await refresh()
  } catch (error) { toast(error.message) } finally { submitting.value = false }
}
</script>
