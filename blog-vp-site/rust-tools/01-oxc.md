# 01 · Oxc — VoidZero 生态核心

**Oxc**（The Oxidation Compiler）是 VoidZero 旗下的 Rust JavaScript/TypeScript 工具套件：解析、语义分析、转译、压缩、Lint、格式化、模块解析共用同一套 AST 与 arena 分配器。对 **Rust 工程直接 embed** 最友好，也是 Rolldown（Vite 8 bundler）、Vitest 新一代工具链的底层引擎。

---

## 1. 定位

### 1.1 流水线角色

Oxc 不是单一「编译器」，而是一组可组合的 crate：

| 组件 | 替代的传统 JS 工具 | 说明 |
| --- | --- | --- |
| Parser | `@babel/parser`、TypeScript parser | 手写递归下降，ES2024+ / TS 全语法 |
| Semantic | ESLint scope analysis | 符号表、作用域、CFG（可选） |
| Transformer | Babel / TS 转译 | JSX、TS strip、语法降级、React Refresh 等 |
| Minifier | Terser | DCE、语法缩短、变量混淆 |
| Codegen | Babel generator | AST → 源码 + source map |
| Linter (Oxlint) | ESLint | 800+ 规则，ESLint 插件兼容 |
| Formatter (Oxfmt) | Prettier | Prettier 兼容格式化 |
| Resolver (`oxc_resolver`) | `enhanced-resolve` | CJS/ESM 模块解析，webpack 行为对齐 |

所有组件共享 **arena 分配**（`oxc_allocator`）：AST 节点在同一块内存中分配，零拷贝传递，无需引用计数。

### 1.2 所属阵营

Oxc 是 [VoidZero](https://voidzero.dev/) 愿景的核心——由 Vue 作者 Evan You 发起，目标是用 Rust 重写整条 JS 工具链（Rolldown bundler、Vitest、Oxc 编译器套件），组件间无缝协作。

### 1.3 被谁依赖

- **Rolldown**（Vite 8 默认 bundler）：parse + transform + minify
- **Nuxt**：解析层
- **Nova、swc-node、knip**：`oxc_resolver` 模块解析
- **Oxlint / Oxfmt**：面向终端用户的 CLI 封装

---

## 2. 前端工程中的使用

### 2.1 npm 包一览

| npm 包 | 用途 |
| --- | --- |
| `oxlint` | ESLint 兼容 linter，CI 与本地 lint |
| `oxfmt` | Prettier 兼容 formatter |
| `oxc-parser` | 独立 parser，返回 ESTree 兼容 AST |
| `oxc-transform` | 独立 transformer |
| `oxc-resolver` | 模块路径解析 |
| `oxc-minify` | 独立 minifier |
| `eslint-plugin-oxlint` | 关闭 Oxlint 已覆盖的 ESLint 规则 |
| `oxlint-migrate` | 从 ESLint flat config 生成 `.oxlintrc.json` |

### 2.2 快速上手

Oxc 的编译流水线（parse → transform → codegen → minify）在 Node 侧通过 N-API npm 包暴露；**Oxlint / Oxfmt** 则是开箱即用的 CLI 二进制。与 SWC 的 `@swc/cli` 不同，Oxc 目前没有统一的 `@oxc/cli`，各能力分散在独立包中。

**Lint**（CLI，无需 ESLint 配置即可运行）：

```bash
npx oxlint .
npx oxlint --fix src/
```

**Format**（CLI）：

```bash
npx oxfmt --write src/
```

**Parse**（`oxc-parser`，返回 ESTree / TS-ESTree 兼容 AST）：

```javascript
import { parseSync } from "oxc-parser";

const { program, module, errors } = parseSync(
  "input.ts",
  `export const x: number = 1;`
);
console.log(program.type);       // "Program"
console.log(module.staticExports); // ESM 导出信息，无需再 walk AST
```

AST 类型定义见 `@oxc-project/types`；内置 `Visitor` 可遍历节点。若需将 AST 回写为源码，可配合 [`esrap`](https://github.com/Rich-Harris/esrap)（Oxc 官方文档示例）；带 source map 的完整 codegen 走 Rust API 或 transform / minify 内置路径。

**Transform**（`oxc-transform`，TS strip、JSX、语法降级等）：

```javascript
import { transformSync } from "oxc-transform";

const { code, errors } = transformSync("input.tsx", source, {
  target: "es2020",
  jsx: { runtime: "automatic" },
  typescript: { declaration: false },
});
console.log(code);
```

**Minify**（`oxc-minify`，生产压缩 + mangling）：

```javascript
import { minifySync } from "oxc-minify";

const result = minifySync("bundle.js", source, {
  compress: { target: "esnext" },
  mangle: { toplevel: true },
  sourcemap: true,
});
console.log(result.code);
console.log(result.map);
```

Rolldown / Vite 8 生产构建默认走这条 minify 路径，无需手动调用。

**Codegen 说明**：Node 侧无独立 `oxc-codegen` 包——codegen 内嵌于 `oxc-transform`（转译输出）和 `oxc-minify`（压缩输出）中。若需在 Node 侧对裸 AST 做 codegen，目前需走 Rust crate（见 **3.3 完整示例**）或 Rolldown bundler。

**Oxlint 配置**（`.oxlintrc.json`）：

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "rules": {
    "no-unused-vars": "warn",
    "eqeqeq": "error"
  }
}
```

从 ESLint 迁移：

```bash
npx oxlint-migrate eslint.config.js > .oxlintrc.json
```

`oxc-parser`、`oxc-transform`、`oxc-minify` 底层均为 Rust 编译出的 `.node` 原生模块（N-API），各平台预编译二进制随 npm 包分发。理解 N-API 绑定原理可参见 [`napi-rs-demo/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/napi-rs-demo/)。

### 2.3 框架集成

- **Vite 8+**：底层 Rolldown 自动消费 Oxc，无需额外配置
- **Webpack**：`oxc-webpack-loader` / `oxc-webpack-plugin`
- **编辑器**：VS Code / IntelliJ 插件（`oxc-vscode`、`oxc-intellij-plugin`）

### 2.4 与 Rolldown / Vitest 的关系

Rolldown 是 Rollup 兼容 bundler，parse/transform/minify 走 Oxc 流水线。Vite 8 将 Rolldown 作为默认生产 bundler，开发时的 HMR 仍由 Vite 自身处理，但编译核心已切换到 Rust。Vitest 也在逐步对接 VoidZero 生态，共享同一套 parser 与 resolver。

---

## 3. Rust 工程中直接使用

### 3.1 依赖配置

推荐使用聚合 crate `oxc`，通过 feature flag 按需启用：

```toml
[dependencies]
oxc = { version = "0.142", features = ["full"] }
```

按需裁剪（减小编译体积）：

```toml
oxc = { version = "0.142", features = ["semantic", "transformer", "codegen"] }
```

| Feature | 启用模块 |
| --- | --- |
| `full` | 全部工具 |
| `semantic` | 语义分析 |
| `transformer` | 转译 |
| `minifier` | 压缩 + mangler |
| `codegen` | 源码输出 |
| `ast_visit` | AST 遍历 |

模块解析单独使用 `oxc_resolver` crate，不依赖完整 `oxc`。

### 3.2 标准流水线

```text
Allocator → Parser → SemanticBuilder → Transformer → Codegen → Minifier
```

各阶段在同一 arena 中操作 AST，semantic 产出的 `Scoping` 供 transformer / linter 消费。

### 3.3 完整示例：parse → transform → codegen

```rust
use std::path::Path;

use oxc::{
    allocator::Allocator,
    codegen::{Codegen, CodegenOptions},
    parser::Parser,
    semantic::SemanticBuilder,
    span::SourceType,
    transformer::{TransformOptions, Transformer},
};

fn main() {
    let source_text = r#"
        const greeting: string = "hello oxc";
        console.log(greeting);
    "#;
    let filename = Path::new("input.ts");
    let source_type = SourceType::ts();

    // 1. Arena 分配
    let allocator = Allocator::default();

    // 2. Parse
    let ret = Parser::new(&allocator, source_text, source_type).parse();
    let mut program = ret.program;

    // 3. Semantic analysis
    let scoping = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&program)
        .semantic
        .into_scoping();

    // 4. Transform (strip TS, lower syntax)
    let options = TransformOptions::enable_all();
    Transformer::new(&allocator, filename, &options)
        .build_with_scoping(scoping, &mut program);

    // 5. Codegen
    let code = Codegen::new()
        .with_options(CodegenOptions::default())
        .build(&program)
        .code;

    println!("{code}");
}
```

运行：`cargo run`（完整源码见 [`rust-tools-demo/oxc`](https://github.com/shenjunjian/wasm-road-blog/tree/main/rust-tools-demo/oxc/)）。

### 3.4 仅 parse + semantic（静态分析）

若只需 lint 或自定义 AST 遍历，parse 后走 `SemanticBuilder` 即可，不必 codegen：

```rust
use oxc::{
    allocator::Allocator,
    ast_visit::Visit,
    parser::Parser,
    semantic::SemanticBuilder,
    span::SourceType,
};

struct Counter { functions: u32 }

impl<'a> Visit<'a> for Counter {
    fn visit_function(&mut self, _: &oxc::ast::ast::Function<'a>, _: oxc::semantic::ScopeFlags) {
        self.functions += 1;
    }
}

let allocator = Allocator::default();
let ret = Parser::new(&allocator, source, SourceType::tsx()).parse();
let semantic = SemanticBuilder::new().build(&ret.program).semantic;

let mut counter = Counter { functions: 0 };
counter.visit_program(&ret.program);
println!("functions: {}", counter.functions);
```

需启用 `ast_visit` feature。

### 3.5 crate 拆分地图

Oxc monorepo 含 30+ crate，常用独立 crate：

| Crate | 职责 |
| --- | --- |
| `oxc_allocator` | Arena 内存 |
| `oxc_ast` | AST 定义 |
| `oxc_parser` | 解析 |
| `oxc_semantic` | 语义分析 |
| `oxc_transformer` | 转译 |
| `oxc_codegen` | 代码生成 |
| `oxc_minifier` | 压缩 |
| `oxc_linter` | Lint 规则引擎 |
| `oxc_resolver` | 模块解析（可独立使用） |

聚合 crate `oxc` 重新导出上述模块，适合快速上手；生产 embed 可按需依赖子 crate 以控制编译时间。

---

## 4. 集成模式

| 模式 | Oxc 的实现 | 说明 |
| --- | --- | --- |
| 纯 Rust crate | ✅ 首选 | `oxc` / `oxc_resolver` 直接 `cargo add`，API 稳定、文档齐全 |
| N-API | `oxc-parser`、`oxc-transform` 等 npm 包 | Node 侧调用，底层 Rust；参见 [`napi-rs-demo/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/napi-rs-demo/) 理解 N-API 绑定原理 |
| WASM | 暂无官方 `@oxc/wasm` | 浏览器场景可等待社区方案，或自行用 `wasm-bindgen` 包装所需 crate |

**Oxlint / Oxfmt** 是 CLI 二进制，对前端项目而言是「安装即用」，不暴露 Rust API。

**推荐路径**：

- 写 Rust CLI / 代码生成器 → 纯 crate
- 写 Webpack/Vite 插件（Node 侧）→ npm 包或 N-API
- 浏览器内编译 → 目前 Utoo / Vize 的 WASM 方案更成熟（见 [03-utoo](./03-utoo.md)、[04-vize](./04-vize.md)）

---

## 5. 选型建议

### 5.1 何时选 Oxc

- 新建 Rust 工具，需要 parse / transform / lint 全套能力
- 跟随 VoidZero 生态（Vite 8 + Rolldown + Vitest）
- 需要 **webpack 兼容的模块解析**（`oxc_resolver`）
- 追求 **单一依赖、聚合 API**，不想管理 SWC 的 20+ crate

### 5.2 何时考虑 SWC（见 [02-swc](./02-swc.md)）

- 项目深度绑定 **Next.js Compiler**（底层 SWC）
- 已有 SWC 插件 / 自定义 transform pass
- Deno 内置转译层

### 5.3 Oxc vs SWC 简表

| 维度 | Oxc | SWC |
| --- | --- | --- |
| API 形态 | 聚合 crate + feature flags | 分散的 `swc_ecma_*` crate |
| Rust embed 友好度 | ⭐ 高 | 中（需 GLOBALS 闭包） |
| Next.js 集成 | 间接（Rolldown 路线） | ⭐ 原生 |
| Lint / Format | Oxlint + Oxfmt 内置 | 无（需 ESLint + Prettier） |
| 模块解析 | `oxc_resolver` 独立 crate | 无对等物 |
| 成熟度 | 快速发展，VoidZero 押注 | 久经生产，生态广 |

### 5.4 常见错误

| 现象 | 原因 |
| --- | --- |
| AST 节点 use-after-free | 未在同一 `Allocator` 生命周期内使用 |
| transform 后 scope 不一致 | 修改 AST 后未重新 `SemanticBuilder` |
| 编译时间过长 | 启用了 `full` feature 但只需 parser |

---

## 6. 延伸阅读

- 系列索引：[Rust 前端工具链系列](./)
- 下一篇：[02 · SWC — Next.js 编译器](./02-swc.md)
- 粗讲合集：[05 · 其它工具速览](./05-others.md)
- 可运行 demo：[`rust-tools-demo/oxc`](https://github.com/shenjunjian/wasm-road-blog/tree/main/rust-tools-demo/oxc/)
- N-API 原理：[napi-rs-demo](https://github.com/shenjunjian/wasm-road-blog/tree/main/napi-rs-demo/)
- 官方文档：[oxc.rs](https://oxc.rs/)
- 架构说明：[ARCHITECTURE.md](https://github.com/oxc-project/oxc/blob/main/ARCHITECTURE.md)
- VoidZero 愿景：[voidzero.dev](https://voidzero.dev/)
