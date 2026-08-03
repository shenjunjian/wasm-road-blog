# rust-tools-demo

本目录为 [blog/rust-tools/](../blog/rust-tools/) 系列 **重点章（01~04）** 的可运行 demo，与博文 inline 示例一一对应。

## 目录

| 子目录 | 对应博文 | 类型 | 运行方式 |
| --- | --- | --- | --- |
| [`oxc/`](./oxc/) | [01 · Oxc](../blog/rust-tools/01-oxc.md) | Rust crate | `cargo run` |
| [`swc/`](./swc/) | [02 · SWC](../blog/rust-tools/02-swc.md) | Rust crate | `cargo run` |
| [`utoo-pack/`](./utoo-pack/) | [03 · Utoo](../blog/rust-tools/03-utoo.md) | Node + N-API | `npm install && npm run dev` |
| [`vize/`](./vize/) | [04 · Vize](../blog/rust-tools/04-vize.md) | Vite + N-API | `npm install && npm run dev` |

## 前置条件

- **Rust demo**（oxc、swc）：Rust 1.78+，`cargo` 可用
- **Node demo**（utoo-pack、vize）：Node 22+（Vize 要求），npm / pnpm / ut 均可

## Rust demo

### Oxc — parse → transform → codegen

```bash
cd oxc
cargo run
# 输出 strip TS 后的 JS
```

### SWC — TypeScript → JavaScript（GLOBALS 闭包）

```bash
cd swc
cargo run
# 输出 strip TS 后的 JS
```

## Node demo

### Utoo — @utoo/pack 本地打包

需先安装 [utoo](https://utoo.land/) 包管理器（或使用 npm 安装 `@utoo/pack-cli` 后通过 `npx up` 运行）：

```bash
cd utoo-pack
npm install
npm run dev    # up dev，HMR dev server
npm run build  # up build，输出到 dist/
```

`@utoo/web` 浏览器 WASM 开发环境配置较复杂（OPFS + 多 Worker + Service Worker），详见 [03-utoo](../blog/rust-tools/03-utoo.md) 与 [utoo.land](https://utoo.land/)。

### Vize — @vizejs/vite-plugin

```bash
cd vize
npm install
npm run dev          # Vite dev server，Rust SFC 编译
npm run vize:lint    # Patina lint
npm run vize:check   # Canon 类型检查
```

> Vize 处于 Real World Testing 阶段，npm 包版本可能随发布变动，安装失败时请查阅 [vizejs.dev/stability](https://vizejs.dev/stability)。

## 与仓库其它 demo 的关系

| demo | 侧重 |
| --- | --- |
| [`napi-rs-demo/`](../napi-rs-demo/) | N-API 绑定原理（通用） |
| [`wasm-road-demo/`](../wasm-road-demo/) | 浏览器 Wasm 加载（通用） |
| **rust-tools-demo/**（本目录） | Oxc / SWC / Utoo / Vize 工具链实操 |
