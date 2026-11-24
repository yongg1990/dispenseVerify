import { ref } from 'vue'
import { onShow, onHide, onReachBottom } from '@dcloudio/uni-app'
import { dayKey, loadRecordPage, requestContext, toast } from '../domain/pharmacy'

export function useRecordHistory(kind) {
  const startTime = ref(dayKey())
  const endTime = ref(dayKey())
  const records = ref([])
  const total = ref(null)
  const loading = ref(false)
  const hasMore = ref(true)
  const error = ref(false)
  let nextPage = 1
  let generation = 0
  let contextKey = ''

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    const currentKey = requestContext().key
    if (currentKey !== contextKey) { refresh(); return }
    const currentGeneration = generation
    loading.value = true; error.value = false
    try {
      const result = await loadRecordPage(kind, { startTime: startTime.value, endTime: endTime.value, pageNum: nextPage, pageSize: 20 })
      if (currentGeneration !== generation || requestContext().key !== contextKey) return
      records.value.push(...result.records)
      total.value = result.total
      hasMore.value = result.hasMore
      nextPage++
    } catch (cause) {
      if (currentGeneration === generation && requestContext().key === contextKey) {
        error.value = true
        toast(cause.message)
      }
    } finally { if (currentGeneration === generation) loading.value = false }
  }

  function refresh() {
    generation++
    contextKey = requestContext().key
    records.value = []; total.value = null; nextPage = 1; hasMore.value = true; loading.value = false; error.value = false
    return loadMore()
  }
  function changeDates({ startTime: start, endTime: end }) {
    if (!start || !end || start > end) { toast('开始日期不能晚于结束日期'); return }
    startTime.value = start; endTime.value = end
    refresh()
  }
  onShow(refresh)
  onHide(() => { generation++; loading.value = false })
  onReachBottom(() => { if (!error.value) loadMore() })
  return { startTime, endTime, records, total, loading, hasMore, error, refresh, changeDates, loadMore }
}
