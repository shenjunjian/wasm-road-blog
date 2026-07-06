# jco P2 Host

Node.js 宿主：通过 `@bytecodealliance/jco` 将 `wasi-p2-cli-demo` 产物 transpile 为 JS 并调用。

> 骨架占位，完整实现见任务 3（demo-p3-jco）。

## 前置依赖

- Node.js 20+
- 已构建 `wasi-p2-cli-demo` 的 `wasm32-wasip2` release 产物

## 计划流程

```bash
npm install
# jco transpile ../../target/wasm32-wasip2/release/wasi-p2-cli-demo.wasm -o ./generated
# node run.js
```
