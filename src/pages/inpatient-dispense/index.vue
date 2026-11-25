<template>
  <AppShell title="住院发药" active="inpatient-dispense" back nursing business-picker @business-change="reset" @ward-change="reset" @conflict="refresh">
    <template v-if="state.business === 'inpatient'">
      <ScanPanel title="扫描药包二维码" subtitle="住院药包 · 发药核验" @scan="scan" />
      <view class="input-action"><view class="search-field"><AppIcon name="scan-line" :size="18" /><input v-model="code" placeholder="输入药包原始码值" confirm-type="search" @confirm="lookup" /></view><button class="primary-button compact" :disabled="loading || submitting" @click="lookup">查询</button></view>
      <PrescriptionCard v-if="selected" :row="selected">
        <view class="success-inline"><AppIcon name="shield-check" :size="17" />病区核验一致</view>
        <button class="primary-button card-action" :disabled="submitting || selected.dispensed" @click="confirm">{{ selected.dispensed ? '已发药' : submitting ? '提交中' : '确认发药' }}</button>
      </PrescriptionCard>
      <view class="section-heading"><text>待发药处方</text><text class="section-meta">{{ pending.length }} 条</text></view>
      <view class="input-action"><view class="search-field"><AppIcon name="search" :size="18" /><input v-model="keyword" placeholder="姓名 / 登记号 / 处方号 / 住院号 / 床号" confirm-type="search" @confirm="refresh" /></view><button class="secondary-button compact" :disabled="submitting" @click="refresh">搜索</button></view>
      <PackageSelection v-if="pending.length" v-model="checkedIds" :rows="pending" compact-details :selectable="canSelect" :blocked-reason="blockedReason" :disabled="submitting" action-label="确认发药" @confirm="confirmSelected" />
      <EmptyState v-else icon-only title="暂无待发药处方" />
      <button class="record-link" @click="navigate('dispense-records')"><AppIcon name="file-check-2" :size="20" /><text class="grow">今日住院发药</text><text>{{ todayCount('dispense') }} 条</text><AppIcon name="chevron-right" :size="18" /></button>
    </template>
    <EmptyState v-else title="住院发药仅适用于住院业务" />
  </AppShell>
</template>
<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import ScanPanel from '../../components/ScanPanel.vue'
import PrescriptionCard from '../../components/PrescriptionCard.vue'
import PackageSelection from '../../components/PackageSelection.vue'
import EmptyState from '../../components/EmptyState.vue'
import { state, currentWard, operator, searchDispense, findWardPackage, dispensePackage, loadToday, refreshRequests, todayCount, navigate, toast, matchesCurrentWard } from '../../domain/pharmacy'
import { scanCode } from '../../services/scanner'
const code = ref(''); const keyword = ref(''); const selected = ref(null)
const loading = ref(false); const submitting = ref(false); const checkedIds = ref([]); const errors = ref({})
const pending = computed(() => state.dispenseRows.filter(row => !row.dispensed && !row.dispensedAt))
function blockedReason(row) {
  if (!row.recordId) return '缺少处方记录ID'
  return matchesCurrentWard(row) ? '' : '药包病区与当前病区不一致'
}
const canSelect = row => !blockedReason(row)
onShow(refresh)
async function refresh() {
  if (state.business !== 'inpatient') return
  try { await refreshRequests([() => searchDispense(keyword.value), () => loadToday('dispense')]) } catch (error) { toast(error.message) }
}
function reset() { code.value = ''; keyword.value = ''; selected.value = null; checkedIds.value = []; errors.value = {}; refresh() }
async function lookup() {
  if (loading.value || submitting.value) return
  loading.value = true; selected.value = null
  try { selected.value = await findWardPackage(code.value); code.value = '' } catch (error) { toast(error.message) } finally { loading.value = false }
}
async function scan() { try { code.value = await scanCode(); await lookup() } catch (error) { toast(error.message) } }
async function confirm() {
  if (!selected.value || submitting.value) return
  submitting.value = true
  try {
    const row = selected.value
    const data = await dispensePackage(row)
    Object.assign(row, data, { dispensed: true })
    toast(data.alreadyDispensed ? '该批次此前已发药' : '发药成功')
    await refresh()
  } catch (error) { toast(error.message) } finally { submitting.value = false }
}
async function confirmSelected(rows) {
  if (submitting.value || !rows.length) return
  submitting.value = true; errors.value = {}
  const context = state.contextKey; let success = 0; let failed = 0
  try {
    for (const row of rows) {
      if (state.contextKey !== context) break
      try { await dispensePackage(row); success++; checkedIds.value = checkedIds.value.filter(id => id !== row.id) }
      catch (error) { errors.value[row.id] = error.message; failed++ }
    }
    if (state.contextKey === context) { toast(failed ? Object.values(errors.value)[0] : `发药成功 ${success} 个`); await refresh() }
  } finally { submitting.value = false }
}
</script>
