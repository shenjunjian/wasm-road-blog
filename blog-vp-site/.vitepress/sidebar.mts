import type { DefaultTheme } from "vitepress";

/** 顶栏导航：首页 + 各分类入口 */
export const nav: DefaultTheme.NavItem[] = [
  { text: "首页", link: "/" },
  { text: "专题长文", link: "/wasm-fundamentals" },
  { text: "Rust 中高级", link: "/rust-lang/" },
  { text: "Rust 前端工具链", link: "/rust-tools/" },
  { text: "WebGPU 进阶", link: "/webgpu/" },
  { text: "Godot 4.x", link: "/godot/" },
];

/** 侧栏：纯 VitePress 嵌套结构，手写维护 */
export const sidebar: DefaultTheme.Sidebar = {
  "/": [
    {
      text: "WebGPU 进阶",
      collapsed: false,
      items: [
        { text: "WebGPU 全景流程[✅]", link: "/webgpu/deep" },
        { text: "系列导读", link: "/webgpu/" },
        { text: "01 · 纹理与采样", link: "/webgpu/01-texture-sampling" },
        { text: "02 · 光照模型", link: "/webgpu/02-lighting" },
        { text: "03 · 显式 BindGroupLayout", link: "/webgpu/03-bind-group-layout" },
        { text: "04 · 离屏渲染与后处理", link: "/webgpu/04-offscreen-postprocess" },
        { text: "05 · 阴影映射", link: "/webgpu/05-shadow-mapping" },
        { text: "06 · 透明排序", link: "/webgpu/06-transparency" },
        { text: "07 · GPU Instancing", link: "/webgpu/07-instancing" },
        { text: "08 · Compute 进阶", link: "/webgpu/08-compute-advanced" },
        { text: "09 · 骨骼动画", link: "/webgpu/09-skinning" },
        { text: "10 · 资源生命周期", link: "/webgpu/10-resource-lifecycle" },
        { text: "11 · 性能分析与优化", link: "/webgpu/11-performance" },
        { text: "12 · WGSL 指南", link: "/webgpu/12-wgsl-guide" },
      ],
    },
    {
      text: "专题长文",
      collapsed: false,
      items: [
        {
          text: "Wasm 基础：原理、Rust 编译与 Node 集成",
          link: "/wasm-fundamentals",
        },
        {
          text: "WASI 基础：从 P1 到 P3 的系统接口与 Component 开发",
          link: "/wasi-fundamentals",
        },
        { text: "WebGPU 的渲染原理与 Shader", link: "/webgpu-shader" },
        {
          text: "WebGPU 内部运行原理：Format、Texture 与 GPU 侧到底在干什么",
          link: "/webgpu-secret",
        },
        { text: "浏览器事件绑定与存储原理详解", link: "/browser-event-secret" },
        { text: "JavaScript 边缘服务：从原理到实战", link: "/edge-server" },
        {
          text: "大模型接口演化：从 Chat Completions 到 Responses，再到 Open Responses",
          link: "/chat-api-diff",
        },
      ],
    },
    {
      text: "Rust 中高级",
      collapsed: false,
      items: [
        { text: "系列导读", link: "/rust-lang/" },
        { text: "01 · 模块、包管理与 Cargo.toml", link: "/rust-lang/01-modules-cargo" },
        { text: "02 · 常用数据结构与结构体", link: "/rust-lang/02-collections-structs" },
        { text: "03 · 引用与智能指针", link: "/rust-lang/03-pointers" },
        { text: "04 · Trait 分类与内存布局", link: "/rust-lang/04-traits" },
        { text: "05 · Option、Result 与特有语法", link: "/rust-lang/05-option-result" },
        { text: "06 · 异步与多线程", link: "/rust-lang/06-async-threads" },
      ],
    },
    {
      text: "Rust 前端工具链",
      collapsed: false,
      items: [
        { text: "系列导读", link: "/rust-tools/" },
        { text: "01 · Oxc — VoidZero 生态核心", link: "/rust-tools/01-oxc" },
        { text: "02 · SWC — Next.js 编译器", link: "/rust-tools/02-swc" },
        { text: "03 · Utoo — 蚂蚁统一工具链", link: "/rust-tools/03-utoo" },
        { text: "04 · Vize — Vue 垂直工具链", link: "/rust-tools/04-vize" },
        { text: "05 · 其它工具速览", link: "/rust-tools/05-others" },
      ],
    },
    {
      text: "Godot 4.x",
      collapsed: false,
      items: [
        { text: "系列导读", link: "/godot/" },
        { text: "01 · 概览与编辑器入门", link: "/godot/01-overview" },
        { text: "02 · 场景·节点·树·继承", link: "/godot/02-scene-tree" },
        { text: "03 · 2D 与 3D：选型与区别", link: "/godot/03-2d-vs-3d" },
        { text: "04 · 节点类型全览", link: "/godot/04-node-types" },
        { text: "05 · GDScript 语法基础", link: "/godot/05-gdscript-syntax" },
        { text: "06 · GDScript 进阶与信号", link: "/godot/06-gdscript-advanced" },
        { text: "07 · 资源系统", link: "/godot/07-resources" },
        { text: "08 · 动画", link: "/godot/08-animation" },
        { text: "09 · Tile 与材质", link: "/godot/09-tile-material" },
        { text: "10 · GDScript Shader", link: "/godot/10-shader" },
        { text: "11 · 物理与碰撞", link: "/godot/11-physics" },
        { text: "12 · UI·调试·跨平台导出", link: "/godot/12-ui-debug-export" },
      ],
    },
    {
      text: "鸿蒙开发",
      collapsed: false,
      items: [
        { text: "arkts 入门", link: "/harmonyOS/learn-arkts" },
        { text: "arkui 入门", link: "/harmonyOS/learn-arkui" },
      ],
    },
  ],
};
