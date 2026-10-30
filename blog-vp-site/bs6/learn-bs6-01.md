# Bootstrap 6.0 上手指南：安装、使用、官方 AI 工具与 CSS 变量主题机制

> 基于官方文档 <https://getbootstrap.com/docs/6.0/> 整理，当前版本 **v6.0.0-alpha.1**（v5.3 仍为 stable）。文中所有代码、变量名、类名均取自官方文档原文。

Bootstrap 6 是一次架构级的更新：颜色体系全面转向 `oklch` + `light-dark()`，深色模式不再需要编译两份 CSS；主题定制从「改 Sass 变量重新编译」变成「改 CSS 自定义属性即时生效」；官方还首次提供了面向 AI 编码工具的 `llms.txt` 与 agent skills。下面按四个主题展开。

---

## 一、如何安装

### 1. 包管理器（推荐）

```bash
npm install bootstrap
# 或
pnpm add bootstrap
# 或
yarn add bootstrap
# 或
bun add bootstrap
```

Bootstrap 6 的 JS 组件依赖两个第三方库，**需要一并安装**（用打包器时）：

- `@floating-ui/dom` — 驱动 menu、popover、tooltip 等浮层定位（取代 v5 的 Popper.js）
- `vanilla-calendar-pro` — 新增的 datepicker 组件

```bash
npm i --save bootstrap @floating-ui/dom vanilla-calendar-pro
```

不需要浮层组件可以不装 Floating UI，不需要日期选择器可以不装 Vanilla Calendar Pro。

安装后 `package.json` 中新增了两个可用的元数据字段：

- `sass` — Bootstrap 主 Sass 入口文件路径
- `style` — 用默认配置编译好的非压缩 CSS 路径

另外包根目录附带 `.browserslistrc`，Autoprefixer / Browserslist 等工具会自动读取浏览器目标。

其他包管理器同样可用：

```bash
# RubyGems
gem 'bootstrap', '~> 6.0.0-alpha.1'

# Composer
composer require twbs/bootstrap:6.0.0-alpha.1

# NuGet（.NET Framework；新项目建议用 libman）
Install-Package bootstrap        # 默认（编译产物）
Install-Package bootstrap.sass   # Sass 源码版
```

### 2. CDN

最省事的方式，两个标签引入全部 CSS 和 JS：

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@6.0.0-alpha.1/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-B/GM4XqrwHnWXNOWMbloTmrYXZg10cakYGmpfsR/bbzQ6JAJI4ihuyADKLnBgrCe"
      crossorigin="anonymous">

<script type="module"
        src="https://cdn.jsdelivr.net/npm/bootstrap@6.0.0-alpha.1/dist/js/bootstrap.bundle.min.js"
        integrity="sha384-1a/pXj49ZQ1aHEmrJ+gMw1otqoVsYwlEnlD8mIfY2TV03r20Y0CN7uqx1tQogjPL"
        crossorigin="anonymous"></script>
```

注意两点变化：

1. **JS 入口是 `type="module"`**，不再是 v5 那种普通 `<script>` 全局挂载。
2. `bootstrap.bundle.min.js` 已内置 Floating UI 和 Vanilla Calendar Pro。若想拆开引入，需要用 **import map** 解析裸模块名：

```html
<script type="importmap">
{
  "imports": {
    "@floating-ui/dom": "https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.7.6/dist/floating-ui.dom.esm.min.js",
    "vanilla-calendar-pro": "https://cdn.jsdelivr.net/npm/vanilla-calendar-pro@3.4.0/index.mjs"
  }
}
</script>
<script type="module"
        src="https://cdn.jsdelivr.net/npm/bootstrap@6.0.0-alpha.1/dist/js/bootstrap.min.js"
        integrity="sha384-BJf/nQgxZJU68GxBse97Vdlc8Rh+z9PzzXiS3/BjV+1nQPR7IKn+iJnD3DJvCMaU"
        crossorigin="anonymous"></script>
```

升级版本时 `integrity` 哈希必须同步更新；如果同一文件在不同 CDN 上哈希不一致，说明文件被篡改，不要用（可用 `openssl dgst -sha384 -binary bootstrap.min.js | openssl base64 -A` 自行核验）。

### 3. 手动下载

官方提供两种压缩包：

- **Distribution files** — 编译 + 压缩好的 CSS/JS，开箱即用，不含源码和依赖库
- **Source files** — Sass、JS 源码，需要自备 Sass 编译器、Autoprefixer 和打包器（Rollup/Webpack）

还可以直接用官方模板仓库 [twbs/examples](https://github.com/twbs/examples)，其中有 Sass & JS、Vite、Webpack、Parcel、color-modes 等可跑的示例工程。

---

## 二、如何使用

### 1. 官方 Vite 搭建流程

一个最小的 Vite + Bootstrap 6 项目：

```bash
mkdir my-project && cd my-project
npm init -y
npm i --save-dev vite sass
npm i --save bootstrap @floating-ui/dom vanilla-calendar-pro
mkdir {src,src/js,src/scss}
touch src/index.html src/js/main.js src/scss/styles.scss vite.config.js
```

目录结构：

```
my-project/
├── src/
│   ├── js/
│   │   └── main.js
│   └── scss/
│       └── styles.scss
│   └── index.html
├── package.json
└── vite.config.js
```

`vite.config.js`：

```js
import { resolve } from 'path'

export default {
  root: resolve(__dirname, 'src'),
  build: {
    outDir: '../dist'
  },
  server: {
    port: 8080
  }
}
```

`src/scss/styles.scss` —— 官方推荐用 `@use` 直接引 Bootstrap 全部 Sass 源码：

```scss
// Import all of Bootstrap's CSS
@use "bootstrap/scss/bootstrap";
```

`src/js/main.js`：

```js
// Import our custom CSS
import '../scss/styles.scss'

// Import all of Bootstrap's JS
import * as bootstrap from 'bootstrap'
```

按需具名导入可以让打包器自动 tree-shaking，显著减小体积：

```js
import { Tooltip, Toast, Popover } from 'bootstrap'
```

`package.json` 加启动脚本后 `npm start` 即可。

### 2. 组件类名的新写法（v5 → v6 的核心语法变化）

使用组件时最先要适应的是类名体系重设计。v5 的「基础类 + 颜色类」组合（`btn btn-primary`）换成了「**形态类 + 主题类**」的正交拆分：

```html
<button type="button" class="btn-solid theme-primary">Primary button</button>
<button type="button" class="btn-outline theme-primary">Outline button</button>
<button type="button" class="btn-subtle theme-secondary">Subtle button</button>
<button type="button" class="btn-text theme-primary">Text button</button>

<div class="alert theme-primary"><p>Primary alert</p></div>
<span class="badge theme-primary">Badge</span>
<span class="badge badge-subtle theme-primary">Subtle badge</span>
```

- `btn-solid / btn-outline / btn-subtle / btn-text`：控制按钮**形态**（实心/描边/浅底/纯文字）
- `theme-primary / theme-danger / theme-success …`：控制**语义颜色**

响应式类名换成了**前缀式**语法，和 Tailwind 一致：

```html
<!-- v5: col-6 -->
<!-- v6: md:col-6 -->
<div class="row g-0">
  <div class="md:col-6 vstack gap-3 p-4 bg-body fg-body" data-bs-theme="light">…</div>
  <div class="md:col-6 vstack gap-3 p-4 bg-body fg-body" data-bs-theme="dark">…</div>
</div>
```

断点定义在 `scss/_config.scss` 的 `$breakpoints` map 里（v5 的 `$grid-breakpoints` 改名而来）。`xs`/`sm`/`md` 三档不变，`lg` 起全部上调，且 `xxl` 改名为 `2xl`：

```scss
$breakpoints: (
  xs: 0,       sm: 576px,  md: 768px,
  lg: 1024px,  xl: 1280px, 2xl: 1536px   // v5.3: 992 / 1200 / xxl 1400
);
```

媒体查询也换用了现代 range 语法（`@media (width >= 768px)`），并新增了配套的**容器查询** mixin（`set-container()` / `container-breakpoint-up()`）——navbar、card-group、list-group、stepper 在 v6 已改用 `@container` 响应自身宽度而非视口宽度：

```scss
.navbar { @include set-container(); }          // container-type: inline-size
.widget  { @include container-breakpoint-up(md, sidebar) { … } }  // @container sidebar (width >= 768px)
```

v6 新增了一大批组件：`dialog`、`drawer`、`menu`、`stepper`、`avatar`、`carousel`、`datepicker`、`combobox`、`chips`、`otp-input`、`password-strength`、`range`、`toggler` 等，多数原生依赖 CSS 层叠与新的 CSS 变量体系，表单类组件（如 checkbox）标记方式也简化了：

```html
<div class="form-field">
  <input type="checkbox" id="checkLabel" class="check" />
  <label for="checkLabel">Example checkbox</label>
</div>
```

JS 侧组件初始化仍走 data API 或手动实例化（`import { Tooltip } from 'bootstrap'` 后 `new Tooltip(el)`）。

### 3. 迁移

已有 v4/v5 项目可用官方 migration skill 或文档的 Migration 指南逐类替换，alpha 阶段不建议直接上大生产。

---

## 三、官方 AI 工具：llms.txt + Agent Skills

这是 v6 文档页里专门的一章（Getting started → AI），Bootstrap 团队主动为 LLM 和 agent 编码工具提供了两类资源。

### 1. 机器可读文档（llms.txt 约定）

遵循 [llmstxt.org](https://llmstxt.org/) 规范：

| 文件 | 内容 | 地址 |
| --- | --- | --- |
| `llms.txt` | 全部文档页的索引，含每页链接与描述 | <https://getbootstrap.com/llms.txt> |
| `llms-full.txt` | 全部文档正文合并成的单文件，可直接投喂模型 | <https://getbootstrap.com/llms-full.txt> |

把 `llms-full.txt` 塞进自定义 GPT / RAG 上下文，模型拿到的就是官方口径的用法。

### 2. Agent Skills（一次性安装全部）

Bootstrap 在仓库 `skills/` 目录下发布了成套的 agent skill，每个是一份针对单一任务的、分步的 playbook（SKILL.md）。官方安装命令：

```bash
npx skills add twbs/bootstrap
```

Skills CLI 会把每个 SKILL.md 复制进你的编码 agent（Claude Code、Cursor 等均识别此格式）；安装记录会出现在 skills.sh 上，无需提交申请。

官方提供的 11 个 skill：

| Skill | 用途 |
| --- | --- |
| `bootstrap-v6-install` | 安装 Bootstrap 6 并配置 CDN 或包管理器方式 |
| `bootstrap-npm` | 不用打包器，纯 npm + 命令行编译 Sass 搭建项目 |
| `bootstrap-webpack` | Webpack 接入 Bootstrap 6 的 CSS/JS |
| `bootstrap-parcel` | Parcel 接入 |
| `bootstrap-vite` | Vite 接入 |
| `bootstrap-v5-v6-migration` | v5 → v6 迁移（类名/组件/Sass/JS） |
| `bootstrap-v4-v6-migration` | v4 → v6 跨两级迁移 |
| `bootstrap-component` | 按官方 token map 与主题变量体系编写组件 CSS 与标记 |
| `bootstrap-component-js` | 写组件 TS 源码、继承 BaseComponent、接 data API / 事件 / Floating UI |
| `bootstrap-color-system` | 定制颜色、增删主题色、处理 color mode、色阶与语义 token |
| `bootstrap-utility-api` | 使用/扩展/裁剪 utilities API，生成自定义工具类 |

不想用 CLI 的话，直接在 agent 会话里指到对应 SKILL.md 并描述目标即可——每个 skill 的 `description` 字段告诉 agent 何时该用它，步骤保证输出对齐官方规范。官方同时提醒：agent 产出的改动仍要对照对应文档页审查。

---

## 四、CSS 变量机制

v6 的整个主题系统建立在 CSS Custom Properties 上：**Sass 编译负责生成默认值，运行时定制全部走 CSS 变量**——不重编译就能改主题。

### 1. `bs-` 前缀与 PostCSS 自动生成

所有自定义属性统一带 `bs-` 前缀（`--bs-primary-base`、`--bs-body-font-family`……），避免与第三方 CSS 冲突。这个前缀**不是手写的**：源码 Sass 里写的是无前缀变量（`--border-radius`），构建时由 PostCSS 插件 `postcss-prefix-custom-properties` 自动加上前缀（`--bs-border-radius`）。

想换成自己的前缀（比如做 Bootstrap 封装库时），改 PostCSS 配置即可：

```js
// postcss.config.js
import postcssPrefixCustomProperties from 'postcss-prefix-custom-properties'

export default {
  plugins: [
    postcssPrefixCustomProperties({ prefix: 'custom-' })
  ]
}
```

### 2. Root 变量：一次声明，双模式生效

全局 token 定义在 `_root.scss`，选择器是 `:root, :host`（兼容 Shadow DOM）。v6 的颜色体系与 v5 有本质区别：

**① 色阶用 `oklch` 定义基色，用 `color-mix()` 插值出整个色板。** 每个色系 13 个台阶（025 → 975）：

```css
:root, :host {
  /* blue 色板：基色是 oklch 值，浅阶混白、深阶混黑 */
  --bs-blue-500: oklch(60% 0.24 240deg);
  --bs-blue-100: color-mix(in oklch, var(--bs-white) 80%, oklch(60% 0.24 240deg));
  --bs-blue-900: color-mix(in oklch, var(--bs-black) 64%, oklch(60% 0.24 240deg));
  /* … 025/050/200/300/400/600/700/800/950/975 同理 */
}
```

**② 语义 token 用 `light-dark()` 同时编码明暗两个值**，浏览器按当前 color scheme 自动取值——这就是 v6 深色模式「一行声明、两种模式」的核心：

```css
:root, :host {
  --bs-bg-body:   light-dark(var(--bs-white), var(--bs-gray-975));
  --bs-fg-body:   light-dark(var(--bs-gray-900), var(--bs-gray-050));
  --bs-border-color: light-dark(var(--bs-gray-200), var(--bs-gray-700));
  --bs-link-color: light-dark(var(--bs-primary-base), var(--bs-primary-fg));
  --bs-link-hover-color: color-mix(in oklch, var(--bs-link-color) 90%, #000);

  /* 最后一行开启全局自动深色模式 */
  color-scheme: light dark;
}
```

**③ token 分三层**，这是理解 v6 主题结构的关键：

1. **Palette（色板）**：`--bs-blue-500`、`--bs-red-300` …——纯颜色阶梯，不含语义；
2. **Semantic theme colors（语义主题色）**：`primary / accent / success / danger / warning / info / inverse / secondary` 八种。每种展开 9 个子 token，且大多随 color mode 自适应：

```css
--bs-primary-base:        var(--bs-blue-500);   /* 默认实心背景 */
--bs-primary-fg:          light-dark(var(--bs-blue-600), var(--bs-blue-400)); /* 可读文字色 */
--bs-primary-fg-emphasis: light-dark(var(--bs-blue-800), var(--bs-blue-200));
--bs-primary-bg:          var(--bs-blue-500);
--bs-primary-bg-subtle:   light-dark(var(--bs-blue-100), var(--bs-blue-900)); /* 浅底 */
--bs-primary-bg-muted:    light-dark(var(--bs-blue-200), var(--bs-blue-800));
--bs-primary-border:      light-dark(var(--bs-blue-300), var(--bs-blue-600));
--bs-primary-focus-ring:  light-dark(/* color-mix 混色 */, /* … */);
--bs-primary-contrast:    var(--bs-white);      /* 压在 base 上的文字色 */
```

3. **Layer colors（层级色）**：与颜色无关、只表达「表面/内容/描边」层级，天然双模式：

```css
/* 背景层级：body → 1 → 2 → 3 → 4 */
--bs-bg-1: light-dark(var(--bs-gray-025), var(--bs-gray-950));
--bs-bg-2: light-dark(var(--bs-gray-050), var(--bs-gray-900));
--bs-bg-3: light-dark(var(--bs-gray-100), var(--bs-gray-800));
--bs-bg-4: light-dark(var(--bs-gray-200), var(--bs-gray-700));
/* 前景层级 */
--bs-fg-1: light-dark(var(--bs-gray-800), var(--bs-gray-200));
--bs-fg-2: light-dark(var(--bs-gray-700), var(--bs-gray-300));
/* 描边层级 */
--bs-border-muted: light-dark(var(--bs-gray-200), var(--bs-gray-800));
--bs-border-emphasized: light-dark(var(--bs-gray-400), var(--bs-gray-600));
```

除颜色外，字号、间距、圆角、阴影、z-index、断点也全部变量化：

```css
--bs-spacer-5: 1rem;
--bs-radius-5: 0.5rem;
--bs-font-size-lg: clamp(1.125rem, 1rem + 0.625vw, 1.25rem); /* 流式字号 */
--bs-box-shadow: 0 .125rem .25rem … oklch(from var(--bs-sc, var(--bs-shadow-color)) l c h / …);
--bs-z-menu: 1000;  --bs-z-dialog: 1040;  --bs-z-tooltip: 1060;
--bs-breakpoint-md: 768px; /* 注意：CSS 变量不能写进 media query，仅在 JS 和其他 CSS 场景可用 */
```

阴影用了 `oklch(from …)` 相对颜色语法，配合 `--bs-shadow-color` / `--bs-shadow-strength` 两个旋钮全局调节浓淡。

### 3. Component variables：组件局部变量

几乎每个组件都在**自身基础类上**暴露一组局部变量，作用域天然限制在组件内（也避免嵌套表格之类的样式污染）：

```css
.alert {
  --bs-alert-padding-x: 1.5rem;
  --bs-alert-padding-y: 1rem;
  --bs-alert-border-radius: var(--bs-radius-5);
}
```

改组件样式 = 覆写它身上的这组变量，无需编译 Sass，无需提高特异性跟 Bootstrap 源码打架。官方约定变量尽量挂在组件根类（如 `.navbar` 管 navbar 全家），方便定位。

focus ring 同样全部变量化，可在编译前用 Sass 定默认值、编译后在 `:root` 实时改：

```css
:root {
  --bs-focus-ring-width: 3px;
  --bs-focus-ring-offset: 1px;
  --bs-focus-ring-color: var(--bs-primary-focus-ring);
  --bs-focus-ring: var(--bs-focus-ring-width) solid var(--bs-focus-ring-color);
}
```

---

## 五、如何自定义自己的主题

### 路线 A：纯 CSS 覆写（最快，运行时生效）

适合换皮、做演示、灰度验证。直接在 `:root` 改全局 token，所有读取它的组件一起变；在组件类上改局部变量，只影响该组件：

```css
/* 1) 换品牌色：改 primary 的 base/bg 即可带动按钮、链接等实心场景 */
:root {
  --bs-primary-base: var(--bs-violet-500);
  --bs-primary-bg: var(--bs-violet-500);
  --bs-primary-fg: light-dark(var(--bs-violet-600), var(--bs-violet-400));
  --bs-primary-bg-subtle: light-dark(var(--bs-violet-100), var(--bs-violet-900));
  --bs-primary-border: light-dark(var(--bs-violet-300), var(--bs-violet-600));
}

/* 2) 全局设计基调：圆角和间距 */
:root {
  --bs-radius-5: 1rem;   /* 更圆润 */
  --bs-spacer: 1.25rem;
}

/* 3) 组件级微调 */
.card {
  --bs-card-border-radius: var(--bs-radius-9);
}
```

⚠️ 官方文档「Token playground」特别演示了一个常见坑：**只改 `--bs-primary-base` 不会联动 `bg-subtle / fg / border` 这些派生 token**——它们在编译时就指向了 blue 色板。想要整套「重铸」，要么把派生 token 一起覆写（上面示例 1 的写法），要么走路线 B 在 Sass 层定制 map。

### 路线 B：Sass `$theme-colors` map（编译期，新增/删减主题色）

主题色源头是 `scss/_theme.scss` 里的嵌套 map：

```scss
$theme-colors: defaults(
  (
    "primary": (
      "base": var(--blue-500),
      "fg": light-dark(var(--blue-600), var(--blue-400)),
      "bg-subtle": light-dark(var(--blue-100), var(--blue-900)),
      // … border / focus-ring / contrast 等 9 键
    ),
    "accent": ( … ),
    "success": ( … ),
    // danger / warning / info / inverse / secondary
  ),
  $theme-colors
);
```

`_root.scss` 用双层 `@each` 循环把它展开成 `:root` 下的 `--bs-{name}-{key}` 变量，同时 `$theme-bgs / $theme-fgs / $theme-borders` 三张层图展开成 `--bs-bg-* / --bs-fg-* / --bs-border-*`。

定制通过 `@use … with ()` 传入，`defaults()` 会把你的 map 合并到内置 map 上——**只加你想加的，内置主题保持完整**；某个内置色设成 `null` 即删除：

```scss
@use "../node_modules/bootstrap/scss/bootstrap" with (
  $theme-colors: (
    // 新增一个 brand 主题色 → 自动获得 theme-brand 类和全套 --bs-brand-* 变量
    "brand": (
      "base": var(--indigo-500),
      "bg": var(--indigo-500),
      "contrast": var(--white)
    ),
    // 移除内置 info
    "info": null
  )
);
```

注意 map 是**两层嵌套**，合并只做一层：要改内置 `primary` 的一个子键，得把 `primary` 的整个子 map 传进去。层级色 `$theme-bgs / $theme-fgs / $theme-borders` 用法相同。

编译后，`theme-brand` 这类工具类自动生成，可以像内置色一样用：

```html
<button class="btn-solid theme-brand">Brand button</button>
<div class="alert theme-brand"><p>Brand alert</p></div>
```

### 路线 C：多主题共存 —— `theme-*` 工具类 + 容器继承

v6 的主题色可以**按容器作用域继承**：给父容器挂 `theme-primary`，其内所有支持主题的组件自动变色，个别子组件可用另一个 `theme-*` 就地覆盖：

```html
<div class="vstack gap-3 theme-primary">
  <div class="alert"><p>整片区域继承 primary</p></div>
  <button class="btn-solid">primary 按钮</button>
  <button class="btn-subtle theme-danger">这里改回 danger</button>
  <span class="badge theme-success">这里改 success</span>

  <!-- 想中止继承：theme-reset -->
  <div class="theme-reset">
    <button class="btn-solid">恢复组件默认色</button>
  </div>
</div>
```

`theme-reset` 的实现值得一提：它把每个 `--theme-*` 属性设成 `initial`，使属性失效，从而让 `var(--theme-bg, fallback)` 走 fallback。官方特意警告**这里不能用 `unset`**——`unset` 在可继承属性上的表现是「再继承父级」，等于白做。

### 路线 D：深色/浅色与自定义 color mode

**开关机制**：`:root` 上有 `color-scheme: light dark`，默认跟随操作系统；`data-bs-theme="dark"`（放 `<html>` 上全局强制，放任意元素上只对该子树生效）会覆盖 `color-scheme`，强制该子树内所有 `light-dark()` token 取暗值。

```html
<html data-bs-theme="dark"> … </html>          <!-- 整站强制深色 -->
<div class="menu" data-bs-theme="dark"> … </div> <!-- 仅这一块强制深色 -->
```

**自己写一个主题模式**（如「蓝色主题」）：自定义 `data-bs-theme="blue"` 选择器 + 覆写 token 即可，组件变量一并可在选择器内按组件覆写：

```css
[data-bs-theme="blue"] {
  --bs-fg-body: var(--bs-white);
  --bs-bg-body: var(--bs-blue-500);
  --bs-bg-3: var(--bs-blue-600);
  --bs-hr-border-color: var(--bs-blue-400);

  .menu {
    --bs-menu-bg: color-mix(in lab, var(--bs-blue-600), var(--bs-blue-700));
    --bs-menu-item-hover-bg: var(--bs-blue-700);
  }
  .btn-solid {
    --bs-btn-bg: color-mix(in lab, var(--bs-gray-600), var(--bs-blue-400));
    --bs-btn-focus-box-shadow: 0 0 0 .25rem rgb(255 255 255 / .2);
  }
}
```

```html
<div data-bs-theme="blue"> … </div>
```

**Sass 侧**：无法用 token 表达的自定义样式，用 `color-mode()` mixin 按模式输出，`$color-mode-type` 决定产物是媒体查询还是 data 属性选择器：

```scss
$color-mode-type: data;   // 或 media-query（默认）

@include color-mode(dark) {
  .element {
    color: var(--bs-primary-fg-emphasis);
    background-color: var(--bs-primary-bg-subtle);
  }
}
// data 模式输出： [data-bs-theme=dark] .element { … }
// media 模式输出： @media (prefers-color-scheme: dark) { .element { … } }
```

**官方文档同款主题切换器 JS**（localStorage 记忆 + auto 跟随系统 + 监听系统切换），可直接抄用：

```js
(() => {
  'use strict'
  const getStoredTheme = () => localStorage.getItem('theme')
  const setStoredTheme = theme => localStorage.setItem('theme', theme)
  const getPreferredTheme = () => getStoredTheme() || 'auto'
  const resolveTheme = theme =>
    theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
  const setTheme = theme => {
    const resolved = resolveTheme(theme)
    if (document.documentElement.getAttribute('data-bs-theme') !== resolved) {
      document.documentElement.setAttribute('data-bs-theme', resolved)
    }
  }
  setTheme(getPreferredTheme())

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const stored = getStoredTheme()
    if (stored !== 'light' && stored !== 'dark') setTheme(getPreferredTheme())
  })
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-bs-theme-value]').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const theme = toggle.getAttribute('data-bs-theme-value')
        setStoredTheme(theme)
        requestAnimationFrame(() => setTheme(theme))
      })
    })
  })
})()
```

### 选型速查

| 需求 | 路线 |
| --- | --- |
| 只换品牌色/圆角/间距，运行时可调 | A：CSS 覆写 `:root` |
| 微调单个组件 | A：组件类上覆写 `--bs-{组件}-*` |
| 新增/删除主题色，要 `theme-xxx` 全套工具类 | B：Sass `$theme-colors` + `@use … with` |
| 页面局部多主题、区域染色 | C：`theme-*` 容器继承 + `theme-reset` |
| 支持系统深色 + 手动切换 | D：`data-bs-theme` + 切换器 JS |
| 第三种自定义模式（如 blue） | D：自定义 `data-bs-theme="blue"` + token 覆写 |

---

## 附：本文参考的官方页面

- Install — <https://getbootstrap.com/docs/6.0/getting-started/install/>
- AI（llms.txt 与 skills 清单）— <https://getbootstrap.com/docs/6.0/getting-started/ai/>
- CSS variables — <https://getbootstrap.com/docs/6.0/getting-started/css-variables/>
- Theme（token 体系与 Sass map）— <https://getbootstrap.com/docs/6.0/customize/theme/>
- Color modes — <https://getbootstrap.com/docs/6.0/customize/color-modes/>
- Vite 指南 — <https://getbootstrap.com/docs/6.0/guides/vite/>
- Skill 源码目录 — <https://github.com/twbs/bootstrap/tree/main/skills>
