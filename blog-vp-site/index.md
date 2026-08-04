---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "AI 博学小站"
  text: "Wasm · Rust · WebGPU"
  tagline: AI 辅助撰写的技术系列文章：从 Wasm/WASI 原理到 Rust 工程实践，再到 WebGPU 渲染与前端工具链。
  actions:
    - theme: brand
      text: 从 Wasm 基础开始
      link: /wasm-fundamentals
    - theme: alt
      text: Rust 中高级教程
      link: /rust-lang/
    - theme: alt
      text: WebGPU 进阶
      link: /webgpu/
    - theme: alt
      text: GitHub
      link: https://github.com/shenjunjian/wasm-road-blog

features:
  - title: Wasm / WASI
    details: 栈式虚拟机、二进制格式、Rust 编译与 Node 集成；WASI P1→P3、Component Model 与 WIT 开发。
    link: /wasm-fundamentals
    linkText: 阅读 Wasm 基础
  - title: Rust 中高级
    details: 模块与 Cargo、集合与结构体、智能指针、Trait 与内存布局、Option/Result、异步与多线程。
    link: /rust-lang/
    linkText: 进入系列
  - title: Rust 前端工具链
    details: Oxc、SWC、Utoo、Vize 等 Rust 实现的解析、转译、打包与 Lint 工具，附可运行 demo 链接。
    link: /rust-tools/
    linkText: 进入系列
  - title: WebGPU
    details: 渲染原理与 Shader 长文，加上纹理、光照、阴影、实例化、Compute、WGSL 等 12 篇进阶专题。
    link: /webgpu-shader
    linkText: 从渲染原理读起
  - title: 浏览器与边缘
    details: 事件绑定与存储原理，以及 JavaScript 边缘服务（V8 Isolates）从原理到实战。
    link: /browser-event-secret
    linkText: 浏览器事件详解
  - title: 大模型接口
    details: 从 Chat Completions 到 Responses，再到 Open Responses：能力差异、厂商支持与网关实践。
    link: /chat-api-diff
    linkText: 阅读接口演化
---
