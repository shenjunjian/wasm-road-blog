# jco P3 Host

Node.js 宿主：通过 `@bytecodealliance/jco` 的 `preview3-shim` 调用 `wasi-p3-cli-demo` async Component。

> 骨架占位，完整实现见任务 3（demo-p3-jco）。

## 前置依赖

- Node.js 20+
- Rust nightly + `wasm32-wasip3` target
- Wasmtime 43+（CLI 验证用）

## 计划流程

```bash
npm install
# jco transpile --preview3-shim ../../target/wasm32-wasip3/release/wasi-p3-cli-demo.wasm -o ./generated
# node run.js
```
