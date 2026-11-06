import { h } from 'vue'

export const BrowserCheckbox = {
  props: { value: String, checked: Boolean, disabled: Boolean, color: String },
  setup: props => () => h('input', { type: 'checkbox', value: props.value, checked: props.checked, disabled: props.disabled, style: { accentColor: props.color, width: '18px', height: '18px', flexShrink: 0, margin: 0 } })
}
export const BrowserCheckboxGroup = {
  emits: ['change'],
  setup: (_, { slots, emit }) => () => h('div', {
    onChange: event => emit('change', { detail: { value: [...event.currentTarget.querySelectorAll('input:checked')].map(input => input.value) } })
  }, slots.default?.())
}

let navigateTo = () => {}
const knownPaths = new Set(['home', 'accept', 'dispense', 'accept-records', 'dispense-records', 'ward-receive', 'profile'].map(name => `/pages/${name}/index`))
const storage = new Map()
const STORAGE_PREFIX = 'pharmacy-single-html:'
let toastTimer
let closeSheet = () => {}

export function currentPath() {
  const route = location.hash.slice(1)
  return knownPaths.has(route) ? route : '/pages/home/index'
}

function routeTo({ url }) {
  if (!knownPaths.has(url)) return
  closeSheet()
  if (location.hash.slice(1) !== url) location.hash = url
  else navigateTo(url)
  window.scrollTo(0, 0)
}

function showToast({ title, duration = 2200 }) {
  let toast = document.getElementById('browser-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'browser-toast'
    toast.className = 'browser-toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    document.body.append(toast)
  }
  toast.textContent = title
  toast.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.hidden = true }, duration)
}

function showActionSheet({ title, itemList, success, fail }) {
  closeSheet()
  const previousFocus = document.activeElement
  const mask = document.createElement('div')
  mask.className = 'modal-mask browser-action-mask'
  const sheet = document.createElement('div')
  sheet.className = 'confirmation-sheet browser-action-sheet'
  sheet.setAttribute('role', 'dialog')
  sheet.setAttribute('aria-modal', 'true')
  const heading = document.createElement('div')
  heading.className = 'sheet-heading'
  heading.id = 'browser-action-title'
  heading.textContent = title || '请选择'
  sheet.setAttribute('aria-labelledby', heading.id)
  sheet.append(heading)
  let finished = false
  const dismiss = (cancelled = true) => {
    if (finished) return
    finished = true
    mask.remove()
    document.removeEventListener('keydown', onKey)
    closeSheet = () => {}
    previousFocus?.focus()
    if (cancelled) fail?.()
  }
  const onKey = event => {
    if (event.key === 'Escape') dismiss()
    if (event.key !== 'Tab') return
    const buttons = [...sheet.querySelectorAll('button')]
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  itemList.forEach((label, tapIndex) => {
    const button = document.createElement('button')
    button.className = 'browser-action-option'
    button.textContent = label
    button.addEventListener('click', () => { dismiss(false); success?.({ tapIndex }) })
    sheet.append(button)
  })
  const cancel = document.createElement('button')
  cancel.className = 'browser-action-option browser-action-cancel'
  cancel.textContent = '取消'
  cancel.addEventListener('click', () => dismiss())
  sheet.append(cancel)
  mask.append(sheet)
  mask.addEventListener('click', event => { if (event.target === mask) dismiss() })
  document.body.append(mask)
  document.addEventListener('keydown', onKey)
  closeSheet = dismiss
  sheet.querySelector('button')?.focus()
}

export function installBrowserApi(onNavigate) {
  navigateTo = onNavigate
  window.uni = {
    getStorageSync(key) {
      try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) || 'null') }
      catch (_) { return storage.get(key) }
    },
    setStorageSync(key, value) {
      const serialized = JSON.stringify(value)
      try { localStorage.setItem(STORAGE_PREFIX + key, serialized) }
      catch (_) {
        storage.set(key, JSON.parse(serialized))
        throw new Error('浏览器不允许保存本地数据，请允许存储后重试')
      }
    },
    showToast,
    showActionSheet,
    navigateTo: routeTo,
    reLaunch: routeTo
  }
}

// Domain modules initialize during import, before the application mounts.
window.addEventListener('hashchange', () => { closeSheet(); navigateTo(currentPath()); window.scrollTo(0, 0) })
installBrowserApi(() => {})
