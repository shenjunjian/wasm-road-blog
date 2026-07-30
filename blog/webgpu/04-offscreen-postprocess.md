# 04 · 离屏渲染与后处理

交换链纹理的职责是 **最终呈现**；许多效果需要先画到 **离屏 Render Target（RT）**，再经第二趟 Pass 做全屏处理。本文讲 RT 的 `usage` 组合、双 Pass 编码，以及简易 Bloom 管线。

配套 Demo：[`webgpu-shader-demo/postprocess/`](../../webgpu-shader-demo/postprocess/)（`B` 切换 Bloom）。

---

## 1. 离屏纹理

```js
const rt = device.createTexture({
  size: [width, height],
  format: "rgba16float",  // HDR 中间缓冲常用 float 格式
  usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
});
```

必须同时声明 **能当颜色附件写** 与 **能绑给 Shader 采样**。

---

## 2. 两趟 Pass

```text
Pass 1（离屏）: 场景 → rtView，storeOp: "store"
Pass 2（屏幕）: 全屏三角形采样 rt → swap chain
```

全屏三角形只需 3 顶点，覆盖整个 NDC，FS 里用 `uv` 采样 RT。Bloom 可在 Pass 2 内再拆：阈值 → 模糊 RT → 合成。

Demo 结构（[`postprocess/main.js`](../../webgpu-shader-demo/postprocess/main.js)）：

1. `scene.wgsl` — 旋转立方体写入 offscreen  
2. `post.wgsl` — 亮部提取 + 水平/垂直盒式模糊  
3. `composite.wgsl` — 原图 + 模糊加色

---

## 3. loadOp / storeOp

| 附件 | 离屏 Pass | 呈现 Pass |
| --- | --- | --- |
| 颜色 | 常 `clear` + `store` | `clear` 或 `load` + **`store`**（canvas 必须 store） |
| 中间 blur RT | 可 `dontCare` 若每帧重写 | — |

[`webgpu-secret.md`](../webgpu-secret.md) 提过 TBDR 上 `discard` 的优化；离屏中间缓冲在移动端可酌情 `discard`，但 **交换链附件不能 discard**。

---

## 4. 常见错误

- RT format 与 pipeline `targets[0].format` 不一致  
- RT 未加 `TEXTURE_BINDING`，第二 Pass validation 失败  
- resize 时只重建 swap chain，未重建 RT 尺寸

---

## 5. 延伸阅读

- 上一篇：[03 · 显式 BindGroupLayout](./03-bind-group-layout.md)
- 下一篇：[05 · 阴影映射](./05-shadow-mapping.md)
