# 12 · WGSL 指南

WGSL（WebGPU Shading Language）是 WebGPU 唯一的一等着色器语言。本文汇总写 shader 时最常碰到的语法与 GLSL 对照；Demo 用全屏 fragment 切换三种效果，便于对照阅读。

配套 Demo：[`webgpu-shader-demo/wgsl/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/webgpu-shader-demo/wgsl/)（`1` 渐变 / `2` 噪声 / `3` 同心环）。

---

## 1. 类型

| WGSL | 含义 |
| --- | --- |
| `f32` `i32` `u32` | 标量 |
| `vec2f` `vec3f` `vec4f` | 向量 |
| `mat4x4f` | 4×4 矩阵，列主序 |
| `array<T, N>` | 固定长度数组 |

---

## 2. 变量空间

| 前缀 | 用途 |
| --- | --- |
| `var<uniform>` | 只读常量块，对齐严格 |
| `var<storage, read_write>` | SSBO |
| `var<private>` | 函数内私有 |
| `var<workgroup>` | workgroup 共享 |

---

## 3. 入口与插值

```wgsl
@vertex
fn vs_main(@location(0) pos: vec2f) -> @builtin(position) vec4f { /* ... */ }

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f { /* ... */ }
```

- `@builtin(position)`：顶点输出裁剪坐标；片元输入 **像素中心坐标**（需注意 Y 翻转习惯）  
- `@interpolate(flat)`：整数 per-primitive，不插值

---

## 4. Bindings

```wgsl
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var t: texture_2d<f32>;
@group(0) @binding(2) var s: sampler;
```

与 JS `createBindGroupLayout` 的 `binding` 号 **必须一致**。

---

## 5. 与 GLSL 对照（节选）

| GLSL | WGSL |
| --- | --- |
| `in` / `out` | 结构体 + `@location` |
| `uniform Block { }` | `struct` + `var<uniform>` |
| `texture2D` + `sampler2D` | `texture_2d` + `sampler` |
| `mix` | `mix` |
| `fract` | `fract` |

Demo [`wgsl/shaders/main.wgsl`](https://github.com/shenjunjian/wasm-road-blog/blob/main/webgpu-shader-demo/wgsl/shaders/main.wgsl) 含 `hash` 噪声与 `length` 画环，可直接改数实验。

---

## 6. 常见编译错误

- **对齐**：`vec3` 在 uniform 结构里常要垫 `f32`  
- **类型**：`textureSample` 需 `sampler`，不能混 `textureLoad` 参数  
- **entryPoint 名**：与 `createRenderPipeline` 的 `entryPoint` 字符串完全一致

---

## 7. 系列总结

至此 12 篇覆盖：贴图、光照、layout、后处理、阴影、透明、instancing、compute、蒙皮、生命周期、性能、WGSL。与前置 [渲染原理](../webgpu-shader.md) + [内部原理](../webgpu-secret.md) 合起来，构成从 API 到工程实践的完整路径。

返回 [系列索引](./)。
