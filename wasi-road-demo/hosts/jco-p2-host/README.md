# jco P2 Host

Node.js 宿主：通过 `@bytecodealliance/jco` 将 `wasi-p2-cli-demo` 产物 transpile 为 JS 并调用。

## 前置依赖

- Node.js 20+
- 已构建 `wasi-p2-cli-demo` 的 `wasm32-wasip2` release 产物

```bash
# 在 wasi-road-demo 根目录
cargo build --target wasm32-wasip2 --release -p wasi-p2-cli-demo
```

## 使用

```bash
npm install
npm run transpile
npm start -- hello
```

等价于：

```bash
wasmtime run --dir=../../data::/data --env WASI_DEMO=p2 \
  ../../target/wasm32-wasip2/release/wasi-p2-cli-demo.wasm -- hello
```

也可直接用 jco CLI 运行（无需事先 transpile 到 `generated/`）：

```bash
npm run run:jco -- hello
```

## 实现说明

| 文件 | 作用 |
|------|------|
| `run.js` | 加载 transpile 产物并调用 `run.run()` |
| `setup-wasi.js` | 配置 preopen `/data`、环境变量与 args |
| `jco-import.js` | `jco run --jco-import` 钩子（仅 preopen/env） |
| `patch-preview2-shim.js` | 兼容 Rust `File::create` 的 sync 标志（见下） |

### Windows 写入兼容

Rust 标准库 `fs::File::create` 在打开文件时会设置 `requestedWriteSync` 等标志。Wasmtime 接受这些标志，但当前 `@bytecodealliance/preview2-shim` 会直接返回 `unsupported`，导致 Guest 写入失败。

`patch-preview2-shim.js` 在宿主侧过滤这些标志后再调用原始 `openAt`，使 demo 在 Node + jco 路径下与 `wasmtime run` 行为一致。待 upstream 修复后可移除此 patch。
