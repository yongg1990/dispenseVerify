import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const output = path.join(root, 'standalone', 'pharmacy-pda.html')
const pageConfig = JSON.parse(await fs.readFile(path.join(root, 'src/pages.json'), 'utf8'))
const icons = {}
for (const name of await fs.readdir(path.join(root, 'src/static/icons'))) {
  if (name.endsWith('.svg')) {
    const svg = await fs.readFile(path.join(root, 'src/static/icons', name), 'utf8')
    icons[name.slice(0, -4)] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }
}
const styles = []
const tags = { view: 'div', text: 'span', image: 'img', 'scroll-view': 'div', page: 'body' }
const selectorPlugin = {
  postcssPlugin: 'standalone-native-selectors',
  Rule(rule) {
    rule.selector = rule.selector.replace(/(^|[\s>+~,(])(scroll-view|page|view|text|image)(?=[\s.#:[>+~),]|$)/g, (_, prefix, tag) => prefix + tags[tag])
  }
}

// Compile the existing independent pages, adapting only uni-app's browser surface.
const result = await build({
  absWorkingDir: root,
  stdin: {
    contents: `import { createApp, h, shallowRef } from 'vue';
import { installBrowserApi, currentPath, BrowserCheckbox, BrowserCheckboxGroup } from './scripts/standalone/browser-api.js';
${pageConfig.pages.map((page, index) => `import Page${index} from './src/${page.path}.vue';`).join('\n')}
const pages = { ${pageConfig.pages.map((page, index) => `${JSON.stringify('/' + page.path)}: Page${index}`).join(',')} };
const route = shallowRef(currentPath());
installBrowserApi(path => { route.value = path; });
createApp({ setup() { return () => h(pages[route.value] || Page0, { key: route.value }); } }).component('checkbox', BrowserCheckbox).component('checkbox-group', BrowserCheckboxGroup).mount('#app');`,
    resolveDir: root,
    sourcefile: 'standalone-entry.js'
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'inline',
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
  plugins: [{
    name: 'standalone-vue',
    setup(plugin) {
      plugin.onResolve({ filter: /^vue$/ }, () => ({ path: require.resolve('vue/dist/vue.runtime.esm-bundler.js') }))
      plugin.onResolve({ filter: /^@dcloudio\/uni-app$/ }, () => ({ path: path.join(root, 'scripts/standalone/lifecycle.js') }))
      plugin.onLoad({ filter: /\.vue$/ }, async ({ path: filename }) => {
        if (filename === path.join(root, 'src/components/AppIcon.vue')) {
          return {
            contents: `import { h } from 'vue'; const icons = ${JSON.stringify(icons)}; export default { props: { name: { default: 'package' }, size: { default: 22 } }, setup: props => () => h('img', { class: 'app-icon', src: icons[props.name], alt: '', style: { width: props.size + 'px', height: props.size + 'px', flexShrink: 0, verticalAlign: 'middle' } }) };`,
            resolveDir: path.dirname(filename)
          }
        }
        const source = await fs.readFile(filename, 'utf8')
        const { descriptor, errors } = parse(source, { filename })
        if (errors.length) throw errors[0]
        const id = `data-v-single-${Buffer.from(path.relative(root, filename)).toString('hex')}`
        const compiled = compileScript(descriptor, {
          id,
          genDefaultAs: '__sfc__',
          inlineTemplate: true,
          templateOptions: {
            compilerOptions: {
              nodeTransforms: [node => {
                if (node.type !== 1) return
                if (tags[node.tag]) { node.tag = tags[node.tag]; node.tagType = 0 }
                for (const prop of node.props) {
                  if (prop.type === 7 && prop.name === 'on' && prop.arg?.content === 'confirm') {
                    prop.arg.content = 'keyup'
                    prop.modifiers.push('enter')
                  }
                }
              }]
            }
          }
        })
        for (const style of descriptor.styles) {
          const css = compileStyle({ source: style.content, filename, id, scoped: style.scoped, postcssPlugins: [selectorPlugin] })
          if (css.errors.length) throw css.errors[0]
          styles.push(css.code)
        }
        return {
          contents: `${compiled.content}\n${descriptor.styles.some(style => style.scoped) ? `__sfc__.__scopeId = ${JSON.stringify(id)};` : ''}\nexport default __sfc__;`,
          resolveDir: path.dirname(filename)
        }
      })
      plugin.onLoad({ filter: /[\\/]services[\\/]scanner\.js$/ }, async ({ path: filename }) => {
        const source = await fs.readFile(filename, 'utf8')
        return { contents: source.replace(/\s*\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g, ''), resolveDir: path.dirname(filename) }
      })
    }
  }]
})
const globalStyle = await fs.readFile(path.join(root, 'src/styles/global.css'), 'utf8')
const css = compileStyle({ source: globalStyle, filename: 'global.css', id: 'global', postcssPlugins: [selectorPlugin] })
if (css.errors.length) throw css.errors[0]
const browserStyle = await fs.readFile(path.join(root, 'scripts/standalone/browser.css'), 'utf8')
const iconLicense = await fs.readFile(path.join(root, 'src/static/icons/LICENSE'), 'utf8')
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>中药房工作台</title>
<style>${[css.code, ...styles, browserStyle].join('\n').replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
<div id="app"></div>
<noscript>请启用 JavaScript 后使用中药房工作台。</noscript>
<script>${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>
<!-- Embedded Lucide icons license:\n${iconLicense.replace(/--/g, '- -')} -->
</body>
</html>
`
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, html, 'utf8')
console.log(`单文件 HTML 已生成：${output}（${Math.ceil(Buffer.byteLength(html) / 1024)} KB）`)
