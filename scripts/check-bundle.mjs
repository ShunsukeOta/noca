import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const dist = fileURLToPath(new URL("../dist/", import.meta.url))
const manifest = JSON.parse(readFileSync(join(dist, ".vite/manifest.json"), "utf8"))
const entry = Object.entries(manifest).find(([, item]) => item.isEntry)?.[0]
if (!entry) throw new Error("Viteのエントリーが見つかりません。npm run buildを先に実行してください。")

const initialKeys = new Set()
function collectStaticImports(key) {
  if (initialKeys.has(key)) return
  const item = manifest[key]
  if (!item) throw new Error(`Vite manifestに ${key} がありません。`)
  initialKeys.add(key)
  for (const imported of item.imports ?? []) collectStaticImports(imported)
}
collectStaticImports(entry)

const initialFiles = [...new Set([...initialKeys].map(key => manifest[key].file).filter(file => file.endsWith(".js")))]
const measure = files => files.reduce((total, file) => {
  const content = readFileSync(join(dist, file))
  total.raw += content.length
  total.gzip += gzipSync(content).length
  return total
}, { raw: 0, gzip: 0 })
const initial = measure(initialFiles)
const largestChunk = Math.max(...Object.values(manifest).filter(item => item.file.endsWith(".js"))
  .map(item => statSync(join(dist, item.file)).size))

const deferred = [
  "src/pages/calendar-page.tsx",
  "src/components/todo-editor-sheet.tsx",
  "src/components/calendar-editor-sheet.tsx",
  "src/components/todo-category-settings.tsx",
  "src/lib/motion-features.ts"
]
for (const key of deferred) {
  if (!manifest[key]?.isDynamicEntry || initialKeys.has(key)) {
    throw new Error(`${key} が初回読み込みに含まれています。`)
  }
}

const worker = readFileSync(join(dist, "sw.js"), "utf8")
const precacheUrls = [...worker.matchAll(/\{url:"([^"]+)",revision:/g)].map(match => match[1])
if (!precacheUrls.length || new Set(precacheUrls).size !== precacheUrls.length) {
  throw new Error("PWAの事前保存一覧を取得できないか、同じファイルが重複しています。")
}
const precacheBytes = precacheUrls.reduce((total, url) => total + statSync(join(dist, url)).size, 0)

const kb = bytes => `${(bytes / 1000).toFixed(2)} kB`
const kib = bytes => `${(bytes / 1024).toFixed(2)} KiB`
console.log(`初回JavaScript: ${kb(initial.raw)} / gzip ${kb(initial.gzip)} (${initialFiles.length}ファイル)`)
console.log(`最大JavaScriptチャンク: ${kb(largestChunk)}`)
console.log(`PWA事前保存: ${kib(precacheBytes)} (${precacheUrls.length}ファイル)`)

const budgets = [
  ["初回JavaScript", initial.raw, 450_000],
  ["初回JavaScript gzip", initial.gzip, 145_000],
  ["最大JavaScriptチャンク", largestChunk, 500_000],
  // The offline sync provider adds a small local queue/cache runtime to the
  // installation precache. Firebase SDK/service chunks remain runtime-cached.
  ["PWA事前保存", precacheBytes, 672 * 1024]
]
for (const [name, actual, limit] of budgets) {
  if (actual > limit) {
    console.error(`${name}が予算を超えました: ${actual} > ${limit} bytes`)
    process.exitCode = 1
  }
}
