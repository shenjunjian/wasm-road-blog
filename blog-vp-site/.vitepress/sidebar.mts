import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DefaultTheme } from 'vitepress'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_ROOT = path.resolve(__dirname, '..')

/** 分类元数据：目录名 → 侧栏分组（未列出的根目录文章归入「专题长文」） */
const SERIES: Record<
  string,
  { text: string; order: number; description?: string }
> = {
  'rust-lang': {
    text: 'Rust 中高级',
    order: 2,
    description: '模块、集合、指针、Trait、错误处理、异步与多线程',
  },
  'rust-tools': {
    text: 'Rust 前端工具链',
    order: 3,
    description: 'Oxc、SWC、Utoo、Vize 与其它 Rust 前端工具',
  },
  webgpu: {
    text: 'WebGPU 进阶',
    order: 4,
    description: '纹理、光照、阴影、实例化、Compute、WGSL 等专题',
  },
}

const STANDALONE = {
  text: '专题长文',
  order: 1,
  description: 'Wasm / WASI / WebGPU / 浏览器 / 边缘服务 / LLM API',
}

/** 独立文章推荐阅读顺序（文件名，不含扩展名） */
const STANDALONE_ORDER = [
  'wasm-fundamentals',
  'wasi-fundamentals',
  'webgpu-shader',
  'webgpu-secret',
  'browser-event-secret',
  'edge-server',
  'chat-api-diff',
]

type DocMeta = {
  link: string
  title: string
  date?: string
  file: string
}

function parseFrontmatter(raw: string): {
  title?: string
  date?: string
  body: string
} {
  if (!raw.startsWith('---')) return { body: raw }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { body: raw }
  const fm = raw.slice(3, end)
  const body = raw.slice(end + 4)
  const title = fm.match(/^\s*title:\s*"?(.+?)"?\s*$/m)?.[1]
  const date = fm.match(/^\s*date:\s*["']?([\d-]+)/m)?.[1]
  return { title, date, body }
}

function firstHeading(body: string): string | undefined {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim()
}

function readDoc(absPath: string, link: string): DocMeta {
  const raw = fs.readFileSync(absPath, 'utf8')
  const { title: fmTitle, date, body } = parseFrontmatter(raw)
  const title = fmTitle || firstHeading(body) || path.basename(absPath, '.md')
  return { link, title, date, file: path.basename(absPath) }
}

function isSeriesIndex(file: string): boolean {
  return /^(index|readme)\.md$/i.test(file)
}

function chapterSortKey(file: string): number {
  if (isSeriesIndex(file)) return -1
  const m = file.match(/^(\d+)/)
  return m ? Number(m[1]) : 9999
}

function collectSeries(dirName: string): DocMeta[] {
  const dir = path.join(DOCS_ROOT, dirName)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const link = isSeriesIndex(f)
        ? `/${dirName}/`
        : `/${dirName}/${f.replace(/\.md$/, '')}`
      return readDoc(path.join(dir, f), link)
    })
    .sort((a, b) => {
      const ka = chapterSortKey(a.file)
      const kb = chapterSortKey(b.file)
      if (ka !== kb) return ka - kb
      return a.file.localeCompare(b.file)
    })
}

function collectStandalone(): DocMeta[] {
  const files = fs
    .readdirSync(DOCS_ROOT)
    .filter(
      (f) =>
        f.endsWith('.md') &&
        f !== 'index.md' &&
        !fs.statSync(path.join(DOCS_ROOT, f)).isDirectory(),
    )
    .map((f) =>
      readDoc(path.join(DOCS_ROOT, f), `/${f.replace(/\.md$/, '')}`),
    )

  const orderIndex = new Map(STANDALONE_ORDER.map((id, i) => [id, i]))
  return files.sort((a, b) => {
    const idA = a.file.replace(/\.md$/, '')
    const idB = b.file.replace(/\.md$/, '')
    const ia = orderIndex.get(idA)
    const ib = orderIndex.get(idB)
    if (ia != null && ib != null) return ia - ib
    if (ia != null) return -1
    if (ib != null) return 1
    if (a.date && b.date) return a.date.localeCompare(b.date)
    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

export function getSeriesMeta() {
  return { STANDALONE, SERIES }
}

/** 按目录自动分类、按章节号/推荐顺序排序生成侧栏 */
export function generateSidebar(): DefaultTheme.Sidebar {
  const groups: Array<{
    order: number
    text: string
    items: DefaultTheme.SidebarItem[]
  }> = []

  const standalone = collectStandalone()
  if (standalone.length) {
    groups.push({
      order: STANDALONE.order,
      text: STANDALONE.text,
      items: standalone.map((d) => ({ text: d.title, link: d.link })),
    })
  }

  for (const [dir, meta] of Object.entries(SERIES)) {
    const docs = collectSeries(dir)
    if (!docs.length) continue
    groups.push({
      order: meta.order,
      text: meta.text,
      items: docs.map((d) => ({
        text: isSeriesIndex(d.file) ? '系列导读' : d.title,
        link: d.link,
      })),
    })
  }

  return groups
    .sort((a, b) => a.order - b.order)
    .map(({ text, items }) => ({ text, collapsed: false, items }))
}

/** 顶栏导航：首页 + 各分类入口 */
export function generateNav(): DefaultTheme.NavItem[] {
  const nav: DefaultTheme.NavItem[] = [{ text: '首页', link: '/' }]

  const standalone = collectStandalone()
  if (standalone[0]) {
    nav.push({ text: STANDALONE.text, link: standalone[0].link })
  }

  for (const [dir, meta] of Object.entries(SERIES).sort(
    (a, b) => a[1].order - b[1].order,
  )) {
    nav.push({ text: meta.text, link: `/${dir}/` })
  }

  return nav
}
