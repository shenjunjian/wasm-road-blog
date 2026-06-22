<div align="center">

  <h1><code>wasm-pack-template</code></h1>

  <strong>使用 <a href="https://github.com/rustwasm/wasm-pack">wasm-pack</a> 快速启动 Rust + WebAssembly 项目的模板。</strong>

  <h3>
    <a href="https://rustwasm.github.io/docs/wasm-pack/tutorials/npm-browser-packages/index.html">教程</a>
    <span> | </span>
    <a href="https://discordapp.com/channels/442252698964721669/443151097398296587">讨论</a>
  </h3>

  <sub>由 <a href="https://rustwasm.github.io/">Rust 与 WebAssembly 工作组</a> 使用 Rust 与 WebAssembly 构建</sub>
</div>

## 简介

请阅读[模板教程][template-docs]。

本模板用于将 Rust 库编译为 WebAssembly，并将生成的包发布到 npm。

更多 `wasm-pack` 模板与用法，请参阅[在线教程][tutorials]。

[tutorials]: https://rustwasm.github.io/docs/wasm-pack/tutorials/index.html
[template-docs]: https://rustwasm.github.io/docs/wasm-pack/tutorials/npm-browser-packages/index.html

## 用法

### 使用 `wasm-pack new` 基于本模板创建项目

```
wasm-pack new my-project
cd my-project
```

### 使用 `wasm-pack build` 构建

```
wasm-pack build
```

### 使用 `wasm-pack test` 在无头浏览器中测试

```
wasm-pack test --headless --firefox
```

### 使用 `wasm-pack publish` 发布到 npm

```
wasm-pack publish
```

## 内置能力

* [`wasm-bindgen`](https://github.com/rustwasm/wasm-bindgen)：在 WebAssembly 与 JavaScript 之间通信。
* [`console_error_panic_hook`](https://github.com/rustwasm/console_error_panic_hook)：将 panic 信息输出到开发者控制台。
* `LICENSE-APACHE` 与 `LICENSE-MIT`：多数 Rust 项目采用此类双许可，已为你预置。

## 许可证

在以下许可中任选其一：

* Apache License, Version 2.0（[LICENSE-APACHE](LICENSE-APACHE) 或 http://www.apache.org/licenses/LICENSE-2.0）
* MIT 许可证（[LICENSE-MIT](LICENSE-MIT) 或 http://opensource.org/licenses/MIT）

### 贡献

除非你明确声明另有约定，否则你为本项目提交的贡献，在 Apache-2.0 许可所定义的范围内，均按上述双许可方式授权，不附加任何额外条款或条件。
