# 04 · Vize — Vue 垂直工具链

**Vize**（/viːz/，Vizier + Visor + Advisor）是用 Rust 编写的 Vue.js 垂直工具链：同一套 parser 与语义模型驱动 **SFC 编译、Lint、格式化、类型检查、LSP、组件画廊（Musea）**。它替代 `@vue/compiler-sfc` + `eslint-plugin-vue` + Prettier + `vue-tsc` 的拼凑组合，走 **Vue 专用、Rust 原生** 路线。

⚠️ **现状**：Vize 处于 **Real World Testing** 阶段，尚未完全 production-ready。API、诊断码、生成输出可能随版本变化，采纳前请阅读 [stability guide](https://vizejs.dev/stability)。

---

## 1. 定位

### 1.1 流水线角色

Vize 不是通用 JS 编译器（那是 Oxc / SWC 的领域），而是 **Vue SFC 全链路** 的垂直整合：

| 组件 | 替代的传统 JS 工具 | Rust crate |
| --- | --- | --- |
| SFC 编译 | `@vue/compiler-sfc` | `vize_atelier_*` |
| Lint | `eslint-plugin-vue` | `vize_patina` |
| Format | Prettier（Vue 部分） | `vize_glyph` |
| 类型检查 | `vue-tsc` | `vize_canon` |
| LSP / 编辑器 | Volar（部分能力） | `vize_maestro` |
| 组件画廊 | Storybook（部分场景） | `vize_musea` |

所有能力共享 **Armature（解析）→ Croquis（语义）** 两层基础，parse 一次、多处复用，避免各工具重复解析 SFC。

### 1.2 静态分析栈

```text
Armature          词法 + 模板/SFC 结构解析
    ↓
Croquis           作用域、绑定元数据、宏信息、跨文件图
    ↓
┌─────────┬──────────┬──────────┬──────────┐
Patina    Canon      Atelier    Maestro
(lint)    (typecheck) (compile)  (LSP)
```

| 层 | 职责 | 消费者 |
| --- | --- | --- |
| **Armature** | Tokenize + 解析 Vue 模板与 SFC 结构 | 编译器、Linter、Formatter |
| **Croquis** | 构建 scope、binding、跨文件依赖图 | 编译、Lint、类型感知检查 |
| **Patina** | Vue/脚本/CSS/a11y/SSR/Vapor 等 lint 规则 | `vize lint`、Oxlint 插件、编辑器 |
| **Canon** | 生成 virtual TypeScript，映射诊断回 Vue 源文件 | `vize check`、编辑器类型检查 |
| **Maestro** | LSP 协议暴露诊断与编辑器功能 | `vize lsp`、VS Code、Zed |

### 1.3 所属阵营

Vize 代表 **框架垂直 Rust 工具链** 路线——与 VoidZero 的通用 JS 层（Oxc）正交：Oxc 服务整条 JS 工具链，Vize 专注 Vue SFC 语义。两者可通过 `oxlint-plugin-vize` 在 Lint 层协作。

### 1.4 被谁依赖 / 集成点

- **Vite 项目**：`@vizejs/vite-plugin`（推荐入口）
- **Nuxt**：`@vizejs/nuxt`（经 Nuxt Vite pipeline）
- **Oxlint 用户**：`oxlint-plugin-vize`
- **实验性**：`@vizejs/rspack-plugin`、`@vizejs/unplugin`

---

## 2. 前端工程中的使用

### 2.1 npm 包一览

| npm 包 | 用途 | 支持层级 |
| --- | --- | --- |
| `@vizejs/vite-plugin` | Vite 内 Rust 原生 SFC 编译 | ⭐ Alpha-supported |
| `vize` | 项目 scripts + 共享 config helper | ⭐ Alpha-supported |
| `@vizejs/native` | N-API 原生绑定（各平台 optional dep） | ⭐ Alpha-supported |
| `@vizejs/wasm` | 浏览器 Wasm 绑定 | 实验性 |
| `oxlint-plugin-vize` | Oxlint 内 Vue 诊断 | 实验性 |
| `@vizejs/vite-plugin-musea` | 组件画廊 / VRT / design tokens | 实验性 |
| `@vizejs/nuxt` | Nuxt 模块 | 兼容性预览 |
| `@vizejs/rspack-plugin` | Rspack 插件 | 兼容性预览 |

### 2.2 快速接入：`vize init`

```bash
vpx vize init                              # 交互式检测 Vite/Nuxt/PM/TS
vpx vize init --dry-run                    # 预览变更，不写入
vpx vize init --yes --lint --bundler --fmt --typecheck --editor
```

`vize init` 自动检测 bundler、包管理器、现有 lint 命令，按需安装 `@vizejs/vite-plugin`、`oxlint-plugin-vize`、配置 `vize.config.*` 与 VS Code 扩展推荐。最小可运行示例见 [`rust-tools-demo/vize`](../../rust-tools-demo/vize/)。

### 2.3 Vite 集成（推荐路径）

**安装**：

```bash
npm install -D @vizejs/vite-plugin vize
npm install @vizejs/native              # 各平台预编译 .node
```

**vite.config.ts**：

```typescript
import { defineConfig } from "vite";
import vize from "@vizejs/vite-plugin";

export default defineConfig({
  plugins: [
    vize({
      sourceMap: true,
      vapor: false,           // Vapor 模式编译
      customRenderer: false,
      templateSyntax: "standard", // standard | strict | quirks
    }),
  ],
});
```

`@vizejs/vite-plugin` 替代 `@vitejs/plugin-vue`，在 Vite transform 阶段直接调用 Rust 编译器，支持 SSR、Vapor mode、scoped CSS、JSX/TSX 等。

### 2.4 共享配置：`vize.config.*`

编译、Lint、类型检查、Formatter、LSP、Musea 共用一份配置，优先级：

`vize.config.pkl` → `.ts` → `.js` → `.mjs` → `.json`

**TypeScript 示例**：

```typescript
import { defineConfig } from "vize";

export default defineConfig(({ command, mode }) => ({
  compiler: {
    sourceMap: mode !== "production",
    vapor: false,
    templateSyntax: "standard",
  },
  linter: {
    enabled: command !== "build",
    preset: "happy-path",   // happy-path | opinionated | ...
  },
  typeChecker: {
    enabled: true,
    strict: true,
    checkProps: true,
    checkTemplateBindings: true,
  },
  formatter: {
    printWidth: 100,
  },
}));
```

### 2.5 项目 scripts

在 `package.json` 中添加 Vize 命名 scripts（底层走 `@vizejs/native` N-API）：

```json
{
  "scripts": {
    "vize:lint": "vize lint",
    "vize:check": "vize check",
    "vize:fmt": "vize fmt",
    "vize:build": "vize build",
    "vize:ready": "vize ready"
  }
}
```

| 命令 | 功能 | 底层 crate |
| --- | --- | --- |
| `vize lint` | Vue 模板/脚本/CSS/a11y 等诊断 | Patina |
| `vize check` | 类型检查，virtual TS 映射回 `.vue` | Canon + Corsa |
| `vize fmt` | SFC 格式化 | Glyph |
| `vize build` | 独立 SFC 编译（非 Vite 场景） | Atelier |
| `vize lsp` | Language Server（Rust CLI 完整功能） | Maestro |

**npm scripts vs Rust CLI**：package scripts 通过 N-API 绑定调用，适合 CI 与日常开发；Rust 原生 `vize` binary 提供 `check-server`、LSP、Corsa 项目级诊断等完整功能。

### 2.6 Oxlint 集成

已有 Oxlint 工作流的项目，可叠加 Vue 诊断：

```bash
npm install -D oxlint oxlint-plugin-vize
```

```javascript
// oxlint.config.js
import vize from "oxlint-plugin-vize";

export default [
  ...vize({ preset: "happy-path" }),
];
```

Patina 规则通过 Oxlint 插件桥接，与 [01-oxc](./01-oxc.md) 的 Oxlint 生态对齐。

### 2.7 Musea — 组件画廊

`@vizejs/vite-plugin-musea` 提供 `.art.vue` 组件示例、design tokens、a11y 检查、VRT（视觉回归测试），替代部分 Storybook 工作流：

```typescript
// vize.config.ts
export default defineConfig({
  musea: {
    include: ["src/**/*.art.vue"],
    basePath: "/__musea__",
  },
});
```

---

## 3. Rust 工程中直接使用

### 3.1 依赖形态

Vize monorepo 含 20+ 可发布 crate，按 [stability tier](https://vizejs.dev/stability) 分级：

| Tier | 代表 crate | embed 建议 |
| --- | --- | --- |
| Alpha-supported | `vize_atelier_sfc`、`vize_armature`、`vize_atelier_core` | 可尝试，遵循 deprecation 窗口 |
| Compatibility preview | `vize_canon`、`vize_patina`、`vize_croquis` | API 可能变动 |
| Experimental | `vize_atelier_vapor`、`vize_musea` | 仅供实验 |
| Bindings | `vize_vitrine` | JS 绑定层，非 library embed 首选 |

**推荐路径**：Vue 项目通过 npm 包消费；Rust 工程若需 embed SFC 编译，优先使用 `vize_atelier_sfc` crate。

### 3.2 crate 拆分地图

```
基础层
├── vize_carton       Arena 内存（Bump allocator）
├── vize_relief       AST 根节点、CompilerOptions
├── vize_armature     模板/SFC 解析（Tokenizer + Parser）
└── vize_croquis      语义分析（scope、binding、跨文件）

编译层 (vize_atelier_*)
├── vize_atelier_core     transform + generate 核心
├── vize_atelier_sfc      SFC parse + compile 入口
├── vize_atelier_dom      模板 → VDOM render function
├── vize_atelier_vapor    Vapor 模式编译
├── vize_atelier_ssr      SSR 输出
└── vize_atelier_jsx      JSX/TSX 编译

分析层
├── vize_patina       Lint 规则引擎
├── vize_canon        virtual TS 生成 + 类型检查
└── vize_glyph        SFC 格式化

工具层
├── vize_maestro      LSP
├── vize_musea        组件画廊
└── vize_vitrine      N-API / WASM 绑定（→ @vizejs/native、@vizejs/wasm）
```

### 3.3 Rust embed 示例：SFC 编译

```rust
use vize_atelier_sfc::{parse_sfc, compile_sfc, SfcCompilerOptions};

fn main() {
    let source = r#"
        <script setup lang="ts">
        const msg: string = "hello vize";
        </script>
        <template><p>{{ msg }}</p></template>
    "#;

    let sfc = parse_sfc(source, "App.vue").expect("parse failed");
    let result = compile_sfc(&sfc, &SfcCompilerOptions::default());
    println!("{}", result.code);
}
```

运行：`cargo add vize_atelier_sfc`（版本随 Vize release 对齐，查阅 [crates.io](https://crates.io/crates/vize_atelier_sfc)）。

### 3.4 Rust embed 示例：Lint

```rust
use vize_patina::{lint, Linter, LintOptions};

let diagnostics = lint(source, "App.vue", &LintOptions {
    preset: "happy-path".into(),
    ..Default::default()
});
for d in diagnostics {
    println!("{}:{} {}", d.line, d.column, d.message);
}
```

Patina 规则是 SFC 上的 visitor，与 ESLint plugin-vue 规则名类似但引擎完全不同。

### 3.5 vize_vitrine — JS 绑定层

`vize_vitrine` 通过 feature flag 分别暴露 N-API 与 WASM：

```toml
# vize_vitrine Cargo.toml 概念
[features]
default = []
napi = ["dep:napi", "dep:napi-derive", ...]
wasm = ["dep:wasm-bindgen", "dep:serde-wasm-bindgen", ...]
```

- **N-API**（`napi` feature）→ 发布为 `@vizejs/native` + 各平台 `@vizejs/native-*-xxx` optional dependency
- **WASM**（`wasm` feature）→ 发布为 `@vizejs/wasm`

这与 [`napi-rs-demo/`](../../napi-rs-demo/) 的多平台预编译模式一致；浏览器侧参见 [`wasm-road-demo/`](../../wasm-road-demo/)。

---

## 4. 集成模式

| 模式 | Vize 的实现 | 说明 |
| --- | --- | --- |
| Vite 插件 | ✅ `@vizejs/vite-plugin` | **推荐**，Alpha-supported |
| npm scripts + N-API | ✅ `vize` + `@vizejs/native` | lint / check / fmt / build |
| Rust CLI binary | ✅ `vize lsp` / `check-server` | 完整 LSP 与项目级诊断 |
| WASM | ⚠️ `@vizejs/wasm` | 实验性，浏览器 SFC 编译 |
| 纯 Rust crate embed | ⚠️ `vize_atelier_sfc` 等 | Alpha crate，SemVer 约束中 |
| Oxlint 桥接 | ⚠️ `oxlint-plugin-vize` | 实验性，与 Oxc 生态协作 |

**推荐路径**：

```text
Vue + Vite 项目        → @vizejs/vite-plugin + vize.config.*
CI lint/check/fmt      → package.json vize:* scripts
已有 Oxlint 工作流     → oxlint-plugin-vize
编辑器（实验）         → vize lsp 或 VS Code 扩展
Rust 自定义工具        → vize_atelier_sfc / vize_patina crate
浏览器内 SFC 编译      → @vizejs/wasm（实验性）
```

**Node 版本要求**：公开 npm 包默认 Node 22+（`oxlint-plugin-vize` 声明 `^22 || >= 24`）。

---

## 5. 选型建议

### 5.1 何时选 Vize

- **Vue 3 项目**，希望编译 + lint + typecheck + format 统一在 Rust 栈
- 追求 `@vue/compiler-sfc` 级别的编译性能提升（官方 benchmark 显示 SFC 编译约 50× 加速）
- 已在用或计划用 **Oxlint**，希望 Vue 规则同命令输出
- 探索 **Vapor mode**、Musea 组件画廊等 Vue 新特性

### 5.2 何时继续用官方 Vue 工具链

| 场景 | 更合适的工具 |
| --- | --- |
| 生产稳定性优先 | `@vitejs/plugin-vue` + `vue-tsc` + ESLint（成熟组合） |
| 非 Vue 项目 | Oxc / SWC / Biome |
| React / Next.js | [02-swc](./02-swc.md) |
| 通用 bundler + PM | [03-utoo](./03-utoo.md) 或 Vite 8 + Rolldown |
| 编辑器类型支持 | 官方 vuejs/language-tools（Volar），Vize LSP 仍实验性 |

### 5.3 Vize vs 官方 Vue 工具链简表

| 维度 | Vize | 官方组合 |
| --- | --- | --- |
| 编译 | `vize_atelier_*`（Rust） | `@vue/compiler-sfc`（JS） |
| Lint | Patina（Rust） | `eslint-plugin-vue`（JS） |
| 类型检查 | Canon + Corsa（Rust 路径） | `vue-tsc`（TS compiler API） |
| Parser 复用 | ⭐ 一次 parse，多能力共享 | 各工具独立解析 |
| 生产就绪 | ⚠️ Real World Testing | ⭐ 成熟 |
| Vite 集成 | `@vizejs/vite-plugin` | `@vitejs/plugin-vue` |
| 与 Oxc 协作 | `oxlint-plugin-vize` | Oxlint 无 Vue 规则 |

### 5.4 常见错误

| 现象 | 原因 |
| --- | --- |
| `@vizejs/native` 加载失败 | 平台 optional dependency 未安装，或 Node 版本低于 22 |
| 类型检查结果与 vue-tsc 不一致 | Vize 以项目 `vue` / `@vue/compiler-sfc` 版本解析类型，需保持依赖对齐 |
| 编译输出与 `@vue/compiler-sfc` 不同 | Vize 处于 RWT 阶段，查阅 [Vue parity matrix](https://github.com/ubugeeei-prod/vize) |
| Oxlint 插件无 Vue 诊断 | 未在 oxlint 配置中引入 `oxlint-plugin-vize` preset |
| `vize check` 找不到 tsconfig | 配置 `typeChecker.tsconfig` 或从项目根目录运行 |

---

## 6. 延伸阅读

- 系列索引：[Rust 前端工具链系列](./README.md)
- 上一篇：[03 · Utoo — 蚂蚁统一工具链](./03-utoo.md)
- 下一篇：[05 · 其它工具速览](./05-others.md)
- 粗讲 Oxc 协作：[01 · Oxc — VoidZero 生态核心](./01-oxc.md)
- 可运行 demo：[`rust-tools-demo/vize`](../../rust-tools-demo/vize/)
- N-API 原理：[napi-rs-demo](../../napi-rs-demo/) · Wasm 加载：[wasm-road-demo](../../wasm-road-demo/)
- 官方站点：[vizejs.dev](https://vizejs.dev/)
- 快速开始：[Getting Started](https://vizejs.dev/getting-started/)
- 静态分析模型：[Static Analysis](https://vizejs.dev/guide/static-analysis/)
- 配置参考：[Configuration](https://vizejs.dev/guide/configuration/)
- 稳定性契约：[Stability](https://vizejs.dev/stability)
- GitHub：[ubugeeei-prod/vize](https://github.com/ubugeeei-prod/vize)
- 快速开始：[Getting Started](https://vizejs.dev/getting-started/)
- 静态分析模型：[Static Analysis](https://vizejs.dev/guide/static-analysis/)
- 配置参考：[Configuration](https://vizejs.dev/guide/configuration/)
- 稳定性契约：[Stability](https://vizejs.dev/stability)
- GitHub：[ubugeeei-prod/vize](https://github.com/ubugeeei-prod/vize)
