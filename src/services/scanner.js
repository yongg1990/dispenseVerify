import { reactive } from 'vue'
import { useStaticData } from './data-source'
import { staticScanOptions } from './static-prescription'

export const staticScan = reactive({ visible: false, title: '', items: [] })
let pendingScan = null

export function finishStaticScan(code) {
  const pending = pendingScan
  pendingScan = null
  staticScan.visible = false
  staticScan.items = []
  if (!pending) return
  if (code) pending.resolve(code)
  else pending.reject(new Error('已取消扫码'))
}

export function scanCode(options = {}) {
  return new Promise((resolve, reject) => {
    if (useStaticData) {
      const items = staticScanOptions(options)
      if (!items.length) { reject(new Error('暂无可扫描的静态数据')); return }
      finishStaticScan()
      pendingScan = { resolve, reject }
      staticScan.title = options.type === 'patient' ? '演示：选择患者就诊码' : '演示：选择药包二维码'
      staticScan.items = items
      staticScan.visible = true
      return
    }
    // #ifdef H5
    reject(new Error('请使用PDA扫码枪输入二维码，或在输入框中输入原始码值'))
    // #endif
    // #ifndef H5
    uni.scanCode({ onlyFromCamera: false, scanType: ['qrCode', 'barCode'], success: result => resolve(result.result), fail: () => reject(new Error('扫描未完成，请重试或手动输入')) })
    // #endif
  })
}
