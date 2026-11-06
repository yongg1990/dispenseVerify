import { mkdir, copyFile } from 'node:fs/promises'

const icons = ['package', 'package-check', 'pill', 'clipboard-list', 'file-check-2', 'scan-line', 'search', 'chevron-left', 'chevron-right', 'arrow-up-right', 'check', 'circle-check', 'x', 'layout-grid', 'user-round', 'hospital', 'bed-double', 'clipboard-check', 'shield-check', 'message-square', 'radio-tower']
const destination = new URL('../src/static/icons/', import.meta.url)
await mkdir(destination, { recursive: true })
for (const name of icons) {
  await copyFile(new URL(`../node_modules/lucide-static/icons/${name}.svg`, import.meta.url), new URL(`${name}.svg`, destination))
}
await copyFile(new URL('../node_modules/lucide-static/LICENSE', import.meta.url), new URL('LICENSE', destination))
console.log(`Prepared ${icons.length} Lucide icons.`)
