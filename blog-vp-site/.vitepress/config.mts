import { createRequire } from 'node:module'
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { generateNav, generateSidebar } from './sidebar.mts'

const require = createRequire(import.meta.url)
const dayjsEsm = require.resolve('dayjs/esm/index.js')

// https://vitepress.dev/reference/site-config
export default withMermaid({
  ...defineConfig({
    title: 'AI 博学小站',
    description: 'AI 辅助撰写的 Wasm / Rust / WebGPU 系列技术文章',
    lang: 'zh-CN',
    lastUpdated: true,
    cleanUrls: true,

    markdown: {
      lineNumbers: true,
    },

    // pnpm + Mermaid：dayjs.min.js 无 ESM default，强制走 ESM 入口
    vite: {
      resolve: {
        alias: [
          {
            find: /^dayjs$/,
            replacement: dayjsEsm,
          },
        ],
      },
      optimizeDeps: {
        include: [
          'dayjs',
          'mermaid',
          'mermaid > dayjs',
          '@braintree/sanitize-url',
          'debug',
          'cytoscape',
          'cytoscape-cose-bilkent',
        ],
        needsInterop: ['dayjs'],
      },
    },

    themeConfig: {
      logo: undefined,
      nav: generateNav(),
      sidebar: generateSidebar(),

      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
            modal: {
              noResultsText: '没有找到相关结果',
              resetButtonTitle: '清除查询',
              footer: {
                selectText: '选择',
                navigateText: '切换',
                closeText: '关闭',
              },
            },
          },
        },
      },

      socialLinks: [
        {
          icon: 'github',
          link: 'https://github.com/shenjunjian/wasm-road-blog',
        },
      ],

      outline: {
        label: '本页目录',
        level: [2, 3],
      },

      docFooter: {
        prev: '上一篇',
        next: '下一篇',
      },

      lastUpdated: {
        text: '最后更新',
      },

      returnToTopLabel: '回到顶部',
      sidebarMenuLabel: '菜单',
      darkModeSwitchLabel: '主题',
      lightModeSwitchTitle: '切换到浅色',
      darkModeSwitchTitle: '切换到深色',

      editLink: {
        pattern:
          'https://github.com/shenjunjian/wasm-road-blog/edit/main/blog-vp-site/:path',
        text: '在 GitHub 上编辑此页',
      },

      footer: {
        message: 'Wasm · Rust · WebGPU · 浏览器与边缘计算',
        copyright: 'Copyright © AI 博学小站',
      },
    },
  }),

  // Mermaid：亮色用 default，深色由插件自动切换
  mermaid: {
    theme: 'default',
    flowchart: {
      curve: 'basis',
      padding: 16,
    },
    themeVariables: {
      fontFamily: 'var(--vp-font-family-base)',
      fontSize: '14px',
    },
  },
  mermaidPlugin: {
    class: 'vp-mermaid',
  },
})
