# 02 · SWC — Next.js 编译器

**SWC**（Speedy Web Compiler）是用 Rust 编写的 JavaScript / TypeScript 编译器，由 Vercel 团队维护。它是 **Next.js Compiler** 的底层引擎，也是 Deno 内置转译层的核心。对前端项目而言，主要入口是 N-API 包 `@swc/core`；对 Rust 工程而言，SWC 提供细粒度的 `swc_ecma_*` crate 组合，但 API 分散且受 **GLOBALS 闭包** 约束。

---

## 1. 定位

### 1.1 流水线角色

SWC 覆盖 Babel 生态中最核心的「parse → transform → minify → codegen」链路：

| 组件 | 替代的传统 JS 工具 | 说明 |
| --- | --- | --- |
| Parser (`swc_ecma_parser`) | `@babel/parser` | ES / TS / JSX / Decorators 解析 |
| Transform (`swc_ecma_transforms_*`) | Babel plugins / presets | TS strip、JSX、语法降级、React Refresh 等 |
| Minifier (`swc_ecma_minifier`) | Terser | 生产环境压缩 |
| Codegen (`swc_ecma_codegen`) | `@babel/generator` | AST → 源码 + source map |
| Plugin API | Babel macro / plugin | WASM 插件（实验性） |

与 Oxc 不同，SWC **不提供** Lint、Format、模块解析等周边能力——这些仍需 ESLint、Prettier、`enhanced-resolve` 或 Oxc 生态补齐。

### 1.2 所属阵营

SWC 是 **Vercel / Next.js 生态** 的编译核心。Next.js 12 起默认启用 SWC 替代 Babel 做单文件转译，Next.js 13 起生产压缩也切换到 SWC minifier。Deno 内置 SWC 做 TypeScript 转译，无需额外配置。

### 1.3 被谁依赖

- **Next.js**：Compiler、minify、部分内置 transform（styled-components、Relay 等）
- **Deno**：内置 TS → JS 转译
- **Parcel 2**：可选 SWC 后端
- **@swc-node/register**：Node 侧 TS 即时编译（类似 ts-node）
- **Rspack**：部分 transform 路径消费 SWC crate

---

## 2. 前端工程中的使用

### 2.1 npm 包一览

| npm 包 | 用途 |
| --- | --- |
| `@swc/core` | 核心 N-API 绑定，`transform` / `parse` / `minify` |
| `@swc/cli` | 命令行转译 |
| `@swc/jest` | Jest 转译 preset |
| `@swc-node/register` | Node require hook，替代 ts-node |
| `swc-loader` | Webpack loader |
| `@swc/wasm` | 浏览器 Wasm 版（功能有限，非主路径） |

### 2.2 @swc/core 快速上手

**Transform**（最常用）：

```javascript
import * as swc from "@swc/core";

const output = await swc.transform(
  `const msg: string = "hello swc";`,
  {
    filename: "input.ts",
    jsc: {
      parser: { syntax: "typescript", tsx: false },
      target: "es2020",
    },
  }
);
console.log(output.code);
// const msg = "hello swc";
```

**Parse**（获取 AST，供自定义工具链消费）：

```javascript
const ast = await swc.parse(`export const x = 1;`, {
  syntax: "typescript",
  target: "es2020",
});
console.log(ast.type); // "Module"
```

**配置文件**（`.swcrc`，可被 CLI / loader 自动读取）：

```json
{
  "$schema": "https://swc.rs/schema.json",
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true
    },
    "transform": {
      "react": { "runtime": "automatic" }
    },
    "target": "es2020"
  },
  "module": { "type": "es6" }
}
```

`@swc/core` 底层是 Rust 编译出的 `.node` 原生模块（N-API），各平台预编译二进制随 npm 包分发。理解 N-API 绑定原理可参见 [`napi-rs-demo/`](../../napi-rs-demo/)。

### 2.3 Next.js Compiler

Next.js 项目 **无需手动调用** `@swc/core`——框架在构建时自动使用 SWC：

- **单文件转译**：strip TS、JSX → `React.createElement` 或 automatic runtime
- **生产压缩**：Next.js 13+ 默认 SWC minifier（比 Terser 快约 7 倍）
- **内置 transform**：styled-components、modularizeImports、React Refresh 等

若项目存在 `.babelrc`，Next.js 会 **回退到 Babel** 做单文件转译。迁移到 SWC 需移除 `.babelrc`，或将自定义逻辑改写为 SWC plugin / 内置 transform 配置。

**Next.js 15+** 中 `swcMinify` 选项已移除，压缩始终走 SWC。

**SWC 插件**（实验性，WASM）：

```javascript
// next.config.js
module.exports = {
  experimental: {
    swcPlugins: [
      ["@swc/plugin-styled-components", {}],
    ],
  },
};
```

### 2.4 其它集成场景

**Webpack**：

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "swc-loader",
        options: {
          jsc: { parser: { syntax: "typescript", tsx: true } },
        },
      },
    ],
  },
};
```

**Deno**：内置 SWC，直接运行 `.ts` 文件即可，无需额外配置。

**Jest**：

```javascript
// jest.config.js
module.exports = {
  transform: { "^.+\\.(t|j)sx?$": ["@swc/jest"] },
};
```

---

## 3. Rust 工程中直接使用

### 3.1 依赖配置

SWC 没有类似 Oxc 的聚合 crate，需按需引入多个子 crate：

```toml
[dependencies]
swc_common = "14"
swc_ecma_parser = "21"
swc_ecma_ast = "14"
swc_ecma_codegen = "16"
swc_ecma_transforms_base = "23"
swc_ecma_transforms_typescript = "24"
```

版本号随 SWC 发布频繁变动，建议查阅 [swc GitHub releases](https://github.com/swc-project/swc/releases) 对齐版本。

也可使用 `swc_core` crate（SWC 内部聚合层），但 API 稳定性不如 `@swc/core` 的 JS 接口。

### 3.2 GLOBALS 闭包——最重要的约束

SWC 用 **span hygiene** 管理标识符作用域与重命名。所有 parse、transform、codegen 操作 **必须在 `GLOBALS.set` 闭包内执行**，否则 panic：

```rust
use swc_common::{Globals, Mark, GLOBALS};

let globals = Globals::default();
GLOBALS.set(&globals, || {
    // parse、transform、codegen 全部写在这里
});
```

这是 SWC 与 Oxc 最大的 embed 体验差异——Oxc 用 arena 生命周期管理，SWC 用线程局部 GLOBALS。

### 3.3 标准流水线

```text
SourceMap + Lexer → Parser → resolver → transform passes → hygiene → fixer → Codegen
```

Transform 阶段通常按以下顺序：

1. **`resolver`** — 标识符作用域分析，分配 `Mark`
2. **自定义 pass** — TS strip、JSX、语法降级等（可多个）
3. **`hygiene`** — 解决同名标识符冲突
4. **`fixer`** — 补全必要括号（可选但推荐）

### 3.4 完整示例：TypeScript → JavaScript

以下示例改编自 SWC 官方 `ts_to_js` example：

```rust
use std::path::Path;

use swc_common::{
    comments::SingleThreadedComments,
    errors::{ColorConfig, Handler},
    sync::Lrc,
    Globals, Mark, SourceMap, GLOBALS,
};
use swc_ecma_codegen::to_code_default;
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax};
use swc_ecma_transforms_base::{fixer::fixer, hygiene::hygiene, resolver};
use swc_ecma_transforms_typescript::strip;

fn main() {
    let cm: Lrc<SourceMap> = Default::default();
    let handler = Handler::with_tty_emitter(ColorConfig::Auto, true, false, Some(cm.clone()));

    let source = r#"const greeting: string = "hello swc";"#;
    let fm = cm.new_source_file(Path::new("input.ts").into(), source.into());

    let comments = SingleThreadedComments::default();
    let lexer = Lexer::new(
        Syntax::Typescript(TsSyntax { tsx: false, ..Default::default() }),
        Default::default(),
        StringInput::from(&*fm),
        Some(&comments),
    );
    let mut parser = Parser::new_from(lexer);
    let program = parser.parse_program().expect("parse failed");

    let globals = Globals::default();
    GLOBALS.set(&globals, || {
        let unresolved_mark = Mark::new();
        let top_level_mark = Mark::new();

        let program = program.apply(resolver(unresolved_mark, top_level_mark, true));
        let program = program.apply(strip(unresolved_mark, top_level_mark));
        let program = program.apply(hygiene());
        let program = program.apply(fixer(Some(&comments)));

        let code = to_code_default(&cm, Some(&comments), &program);
        println!("{code}");
    });
}
```

运行：`cargo run`（完整源码见 [`rust-tools-demo/swc`](../../rust-tools-demo/swc/)）。

### 3.5 自定义 Transform Pass

SWC transform 基于 **Fold** / **VisitMut** trait，与 Rust 编译器 pass 类似：

```rust
use swc_ecma_ast::*;
use swc_ecma_visit::{VisitMut, VisitMutWith};

struct ConsolePrefix;

impl VisitMut for ConsolePrefix {
    fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
        call.visit_mut_children_with(self);
        // 在 console.log 调用前插入标识符等自定义逻辑
    }
}

// 在 GLOBALS.set 闭包内：
program.visit_mut_with(&mut ConsolePrefix);
```

复杂 pass 需在 `resolver` 之后、`hygiene` 之前插入，并配合 `Ident::new_private` 创建私有标识符。

### 3.6 crate 拆分地图

SWC monorepo 含 50+ crate，常用模块：

| Crate | 职责 |
| --- | --- |
| `swc_common` | SourceMap、Span、GLOBALS、错误处理 |
| `swc_ecma_ast` | ECMAScript AST 定义 |
| `swc_ecma_parser` | 解析器 |
| `swc_ecma_codegen` | 代码生成 |
| `swc_ecma_minifier` | 压缩 |
| `swc_ecma_transforms_base` | resolver、hygiene、fixer 等基础 pass |
| `swc_ecma_transforms_typescript` | TS strip |
| `swc_ecma_transforms_react` | JSX / React Refresh |
| `swc_ecma_transforms_compat` | 语法降级 preset |
| `swc_plugin` | WASM 插件宿主 API |
| `swc_compiler_base` | 高层编译入口（@swc/core 底层） |

没有「一个 crate 搞定全部」的入口——embed 时需自行组装流水线并管理版本对齐。

---

## 4. 集成模式

| 模式 | SWC 的实现 | 说明 |
| --- | --- | --- |
| N-API | ✅ `@swc/core` 主路径 | Node 构建工具的标准选择，预编译多平台 binary |
| 纯 Rust crate | ⚠️ 可行但繁琐 | 需管理 5~10 个 crate 版本 + GLOBALS 闭包 |
| WASM | `@swc/wasm` | 功能子集，性能与体积不如 N-API；浏览器场景见 [03-utoo](./03-utoo.md) |

**@swc/core 架构**：

```text
JavaScript API (@swc/core)
    ↓ N-API
swc_compiler_base (Rust)
    ↓
swc_ecma_parser → swc_ecma_transforms_* → swc_ecma_codegen / minifier
```

Node 侧调用 `@swc/core` 即可，无需关心 crate 拆分。Rust 侧 embed 则相反——需直接面对 crate 地图与 GLOBALS 约束。

**SWC Plugin**（WASM 插件）是第四种集成路径：用 Rust 编写 transform pass，编译为 `.wasm`，由 `@swc/core` 或 Next.js 加载。适合无法上游合并的自定义 transform，但 API 仍属实验性。

**推荐路径**：

- Next.js / Node 构建 → `@swc/core`（N-API）
- 已有 SWC 依赖的 Rust 工具（如 bundler 后端）→ 纯 crate
- 新建 Rust 工具、无 SWC 历史包袱 → 优先考虑 Oxc（见 [01-oxc](./01-oxc.md)）
- 浏览器内完整编译 → Utoo / Vize WASM 方案

---

## 5. 选型建议

### 5.1 何时选 SWC

- 项目基于 **Next.js**，Compiler 已内置，无需额外选型
- 需要 **Deno 兼容**或 `@swc-node/register` 做 Node TS 即时编译
- 已有 **SWC WASM 插件**或 `@swc/jest` 等生态投资
- 写 Rust bundler / 工具链，需与 Next.js 共用同一套 transform 逻辑

### 5.2 何时考虑 Oxc（见 [01-oxc](./01-oxc.md)）

- 新建 Rust 工具，希望 **单一 crate + feature flags**
- 需要 **Lint / Format / 模块解析**一体化
- 跟随 **VoidZero 生态**（Vite 8 + Rolldown + Vitest）
- 不想管理 GLOBALS 闭包与 10+ crate 版本对齐

### 5.3 SWC vs Oxc 简表

| 维度 | SWC | Oxc |
| --- | --- | --- |
| API 形态 | 分散的 `swc_ecma_*` crate | 聚合 crate + feature flags |
| Rust embed 友好度 | 中（需 GLOBALS 闭包） | ⭐ 高（arena 生命周期） |
| Next.js 集成 | ⭐ 原生 | 间接（Rolldown 路线） |
| Lint / Format | 无（需 ESLint + Prettier） | Oxlint + Oxfmt 内置 |
| 模块解析 | 无对等物 | `oxc_resolver` 独立 crate |
| 成熟度 | ⭐ 久经生产，Next.js / Deno 验证 | 快速发展，VoidZero 押注 |
| N-API 入口 | `@swc/core` 成熟稳定 | `oxc-parser` 等分包 |

两者在 parse / transform / minify 能力上高度重叠，选型关键看 **生态绑定**而非性能差距。

### 5.4 常见错误

| 现象 | 原因 |
| --- | --- |
| `GLOBALS` panic | parse / transform 未包裹在 `GLOBALS.set` 闭包内 |
| 标识符冲突 / 错误重命名 | 跳过 `resolver` 或 `hygiene` pass |
| crate 版本编译失败 | `swc_ecma_*` 各 crate 版本未对齐 |
| Next.js 仍走 Babel | 项目存在 `.babelrc`，需移除或 `forceSwcTransforms` |

---

## 6. 延伸阅读

- 系列索引：[Rust 前端工具链系列](./README.md)
- 上一篇：[01 · Oxc — VoidZero 生态核心](./01-oxc.md)
- 下一篇：[03 · Utoo — 蚂蚁统一工具链](./03-utoo.md)
- 粗讲合集：[05 · 其它工具速览](./05-others.md)
- 可运行 demo：[`rust-tools-demo/swc`](../../rust-tools-demo/swc/)
- N-API 原理：[napi-rs-demo](../../napi-rs-demo/)
- 官方文档：[swc.rs](https://swc.rs/)
- @swc/core API：[Usage / Core](https://swc.rs/docs/usage/core)
- GLOBALS 说明：[Variable Management](https://swc.rs/docs/contributing/es-commons/variable-management)
- Next.js Compiler：[Architecture](https://nextjs.org/docs/architecture/nextjs-compiler)
