# 03 · 显式 BindGroupLayout

[`raw` 综合 demo](https://github.com/shenjunjian/wasm-road-blog/tree/main/webgpu-shader-demo/raw/) 里 `createRenderPipeline({ layout: "auto" })` 根据 Shader 的 `@group/@binding` **自动推导** 布局。学习阶段很省事；项目变大后，你需要 **显式** 定义 layout，以便多管线共享、多材质复用同一 binding 规划。

配套 Demo：[`webgpu-shader-demo/bind-group/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/webgpu-shader-demo/bind-group/) — 三个立方体，**同一 pipeline**，`group(0)` 共享 `viewProj`，`group(1)` 每物体独立 `model + color`。

---

## 1. 为什么不用 `layout: "auto"`

| `auto` | 显式 layout |
| --- | --- |
| 改 shader binding 可能静默改变 layout | binding 契约在 JS 里可见、可文档化 |
| 每条 pipeline 各自推导 | 多个 pipeline 可共用 `GPUBindGroupLayout` |
| 难以在运行时动态换材质 | 同 layout 下换 `GPUBindGroup` 即可 |

---

## 2. 推荐分组策略

Demo 采用两层：

```text
@group(0)  全局：viewProj、时间、相机 — 每帧写一次，整帧 bind 一次
@group(1)  物体：model、材质色/贴图 — 每个物体一个 bind group
```

WGSL（[`bind-group/shaders/main.wgsl`](https://github.com/shenjunjian/wasm-road-blog/blob/main/webgpu-shader-demo/bind-group/shaders/main.wgsl)）：

```wgsl
@group(0) @binding(0) var<uniform> global: GlobalUniforms;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;
```

---

## 3. JS 创建顺序

```js
const globalLayout = device.createBindGroupLayout({
  entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
});
const objectLayout = device.createBindGroupLayout({
  entries: [{
    binding: 0,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: { type: "uniform" },
  }],
});
const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [globalLayout, objectLayout],
});

const pipeline = device.createRenderPipeline({ layout: pipelineLayout, /* ... */ });
```

录制时：

```js
pass.setBindGroup(0, globalBindGroup);  // 一次
for (const obj of objects) {
  pass.setBindGroup(1, obj.bindGroup);
  pass.drawIndexed(/* ... */);
}
```

---

## 4. BindGroup 与 Buffer 生命周期

- **Layout**：跟着 pipeline 设计走，变得少  
- **BindGroup**：指向具体 buffer/texture view，材质切换时换 bind group  
- **Buffer**：每帧 `writeBuffer` 更新内容，bind group 仍有效（绑的是 buffer 对象）

---

## 5. 与贴图 binding 组合

在 `objectLayout` 里可加 `{ binding: 1, texture: { sampleType: "float" } }` 与 `{ binding: 2, sampler: {} }`。Layout 定好后，不同物体 bind group 可指向不同贴图 view，pipeline 不变——这是材质系统的常见形状。

---

## 6. 常见错误

| 现象 | 原因 |
| --- | --- |
| Pipeline layout doesn't match | `bindGroupLayouts` 顺序与 shader `@group(n)` 不一致 |
| Bind group layout mismatch | `createBindGroup` 的 layout 不是创建 pipeline 时用的那份 |
| 改 shader binding 后全挂 | 仍用旧 layout；显式 layout 需同步改 JS |

---

## 7. 延伸阅读

- 上一篇：[02 · 光照模型](./02-lighting.md)
- 下一篇：[04 · 离屏渲染与后处理](./04-offscreen-postprocess.md)
- MDN：[GPUBindGroupLayout](https://developer.mozilla.org/en-US/docs/Web/API/GPUBindGroupLayout)
