# 05 · 其它工具速览

本系列重点深度介绍了 [Oxc](./01-oxc.md)、[SWC](./02-swc.md)、[Utoo](./03-utoo.md)、[Vize](./04-vize.md) 四个工具。本章对生态中同样重要、但未单独成篇的工具做 **1~2 段粗讲**——覆盖定位、前端入口、Rust embed 能力，以及与重点工具的关系。

每个工具统一回答四个问题：**它是谁？npm/CLI 怎么用？能否 `cargo add` 嵌入？和 Oxc/SWC/Utoo/Vize 怎么配合？**

---

## oxc_resolver

**定位**：Oxc 生态的 **模块路径解析器**，行为对齐 webpack / enhanced-resolve，支持 CJS、ESM、TS `paths`、package exports 等。

**前端入口**：npm 包 `oxc-resolver`（Node N-API 绑定）；被 Rolldown、Nuxt、knip、swc-node 等消费。

**Rust embed**：✅ **独立 crate** `oxc_resolver`，可 `cargo add oxc_resolver` 单独使用，不依赖完整 `oxc` 聚合 crate。适合写 bundler、静态分析工具、依赖扫描器。

**与重点工具的关系**：是 [01 · Oxc](./01-oxc.md) 的独立子模块，也是 Rolldown（Vite 8 bundler）的解析后端。若只需模块解析、不需要 parse/transform，直接用 `oxc_resolver` 即可。

```rust
use oxc_resolver::{ResolveOptions, Resolver};

let resolver = Resolver::new(ResolveOptions::default());
let resolved = resolver.resolve("/project/src/index.ts", "./utils").unwrap();
println!("{:?}", resolved.full_path());
```

---

## Biome

**定位**：**ESLint + Prettier 合一** 的 Web 工具链，Rust 实现，单 CLI 覆盖 JS/TS/JSX/JSON/CSS/HTML/GraphQL 的 format 与 lint（512+ 规则，Prettier 兼容度约 97%）。

**前端入口**：

```bash
npm i -D --save-exact @biomejs/biome
npx @biomejs/biome check --write ./src
```

配置文件 `biome.json`，VS Code 扩展 `@biomejs/biome` 提供 LSP。

**Rust embed**：⚠️ Biome 是 Rust monorepo（`biome_formatter`、`biome_analyze` 等内部 crate），但 **没有类似 Oxc 的稳定公开 library API**。crates.io 上的 crate 主要服务 Biome 自身 CLI/LSP，第三方 embed 不推荐。

**与重点工具的关系**：与 Oxc 的 Oxlint/Oxfmt **功能重叠、路线竞争**——Biome 走「一个工具替代 ESLint + Prettier」；VoidZero 走 Oxc 组件化 + Rolldown。Rspack 内置 Biome 做 lint/format；Vize 通过 `oxlint-plugin-vize` 走 Oxlint 路线而非 Biome。选型上：想要 **All-in-one** 选 Biome；想要 **与 Vite 8 / Rolldown 同生态** 选 Oxlint/Oxfmt。

---

## Lightning CSS

**定位**：Rust 实现的 **CSS 解析、转译、压缩** 工具，替代 PostCSS + cssnano 组合，性能比传统 JS 方案快 100× 以上。Tailwind CSS v4 内置 Lightning CSS 做编译与优化。

**前端入口**：

```bash
npm install lightningcss
```

```javascript
import { transform } from "lightningcss";

const { code } = transform({
  filename: "style.css",
  code: Buffer.from(".foo { color: red; }"),
  minify: true,
});
```

也提供 CLI `lightningcss-cli` 和 Parcel / Webpack loader 集成。

**Rust embed**：✅ crate 名 `lightningcss`（crates.io），可直接 `cargo add lightningcss` 做 CSS parse/minify/targets 降级。API 稳定，适合 embed 到自定义构建流水线。

**与重点工具的关系**：与 Oxc/SWC **正交**——后者处理 JS/TS，Lightning CSS 专注 CSS。Rspack、Parcel 用 Lightning CSS 处理样式；Oxc 目前不提供 CSS 处理能力。写 Rust bundler 时，JS 层用 Oxc/SWC，CSS 层用 Lightning CSS 是常见组合。

---

## Rspack

**定位**：字节跳动出品的 **Webpack 兼容 bundler**，Rust 实现，目标是无缝迁移 Webpack 配置与插件生态，性能大幅提升。

**前端入口**：

```bash
npm install @rspack/core @rspack/cli -D
```

```javascript
// rspack.config.js
module.exports = {
  entry: "./src/index.ts",
  module: {
    rules: [{ test: /\.tsx?$/, use: "builtin:swc-loader" }],
  },
};
```

底层通过 `@rspack/binding` N-API 模块暴露 Rust 引擎；参见 [`napi-rs-demo/`](../../napi-rs-demo/)。

**Rust embed**：⚠️ **N-API 为主**。Rspack 提供有限的 **custom binding** API 供深度集成，但不像 Oxc 那样提供轻量 crate embed 路径。Rust 工程应通过 Node 侧 `@rspack/core` 消费，而非直接依赖内部 crate。

**与重点工具的关系**：转译走 **SWC**（见 [02 · SWC](./02-swc.md)），CSS 走 **Lightning CSS**，lint/format 可选 **Biome**。与 VoidZero（Oxc + Rolldown）是 **竞争路线**——Rspack 押注 Webpack 兼容，VoidZero 押注 Rollup/Vite 兼容。实验性 `@vizejs/rspack-plugin` 提供 Vue SFC 编译接入。

---

## Turbopack

**定位**：Vercel 出品的 Rust **增量 bundler**，Next.js 15+ 的默认构建引擎，基于 `turbo-tasks` 任务图架构实现细粒度缓存与 HMR。

**前端入口**：**无独立 npm 包**——通过 Next.js 项目间接使用（`next dev` / `next build`）。Standalone 使用需 Next.js 框架绑定。

**Rust embed**：❌ **无独立 crate API**。Turbopack 的 Rust crate（`turbo-tasks`、`turbopack-core` 等）未作为稳定公开 library 发布，外部 Rust 工程无法 `cargo add` 嵌入。

**与重点工具的关系**：内部转译依赖 **SWC**；[03 · Utoo](./03-utoo.md) 的 `@utoo/pack` 直接依赖 Turbopack crate 并提供通用 CLI，是 **脱离 Next.js 使用 Turbopack 引擎** 的主要路径。与 Rolldown（Oxc 系）形成 bundler 层双阵营。

---

## Rolldown

**定位**：Rollup 兼容的 Rust bundler，**Vite 8 默认生产 bundler**，由 VoidZero 维护。

**前端入口**：Vite 8+ 自动启用，无需单独安装；也可独立使用 `rolldown` npm 包（实验性 CLI）。

**Rust embed**：⚠️ 底层 parse/transform/minify 走 **Oxc**，但 Rolldown 本身 **不是** 轻量 embed 入口——若要在 Rust 工程中使用编译能力，应直接依赖 `oxc` crate（见 [01 · Oxc](./01-oxc.md)）。

**与重点工具的关系**：Rolldown = Oxc（编译）+ Rollup 兼容打包逻辑 + `oxc_resolver`（模块解析）。是 VoidZero 生态的 bundler 层，与 Rspack（Webpack 系）、Turbopack（Next.js 系）并列。

---

## 速查对比

| 工具 | 一句话 | 前端入口 | Rust embed | 重点工具关系 |
| --- | --- | --- | --- | --- |
| `oxc_resolver` | webpack 兼容模块解析 | `oxc-resolver` | ✅ 独立 crate | Oxc 子模块 → Rolldown |
| Biome | ESLint + Prettier 合一 | `@biomejs/biome` | ⚠️ 无稳定 library API | vs Oxlint/Oxfmt；Rspack 内置 |
| Lightning CSS | CSS parse/minify | `lightningcss` | ✅ `lightningcss` crate | 与 Oxc/SWC 正交；Tailwind v4 |
| Rspack | Webpack 兼容 bundler | `@rspack/core` | ⚠️ N-API 为主 | 用 SWC + Lightning CSS |
| Turbopack | Next.js 增量 bundler | Next.js 内置 | ❌ 无公开 crate API | Utoo 复用其 crate |
| Rolldown | Vite 8 bundler | Vite 8 内置 | ⚠️ 用 Oxc 代替 | VoidZero 生态 → [01-oxc](./01-oxc.md) |

---

## 选型速记

```text
要 webpack 兼容 bundler     → Rspack
要 Next.js / Turbopack 引擎  → Next.js 或 Utoo (@utoo/pack)
要 Vite 8 / Rollup 生态      → Rolldown（底层 Oxc）
要 ESLint+Prettier 二合一    → Biome
要 VoidZero lint/format      → Oxlint + Oxfmt（Oxc）
要 CSS 处理                  → Lightning CSS
要模块解析（Rust embed）     → oxc_resolver
要 Vue 全链路                → Vize
```

---

## 延伸阅读

- 系列索引：[Rust 前端工具链系列](./README.md)
- 可运行 demo：[`rust-tools-demo/`](../../rust-tools-demo/)
- ★ 重点章：[01 Oxc](./01-oxc.md) · [02 SWC](./02-swc.md) · [03 Utoo](./03-utoo.md) · [04 Vize](./04-vize.md)
- 前置阅读：[Wasm 基础](../wasm-fundamentals.md) · [WASI 基础](../wasi-fundamentals.md)
- 仓库 demo：[napi-rs-demo](../../napi-rs-demo/) · [wasm-road-demo](../../wasm-road-demo/)
