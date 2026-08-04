# 06 · 透明排序

[`raw` 综合 demo](https://github.com/shenjunjian/wasm-road-blog/tree/main/webgpu-shader-demo/raw/) 已用 **不透明批次 → 半透明批次** 绘制法术环与粒子。本文聚焦半透明 **为何要先画 opaque、关 depth write**，以及 **多透明面交叉** 时为什么要按距离排序。

配套 Demo：[`webgpu-shader-demo/transparency/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/webgpu-shader-demo/transparency/)（`S` 切换错误顺序 / 正确排序）。

---

## 1. 半透明 pipeline 状态

```js
depthStencil: {
  depthWriteEnabled: false,  // 不写深度，避免挡住更远的透明面
  depthCompare: "less",      // 仍测试深度，被墙挡住的应丢弃
},
fragment: {
  targets: [{
    format,
    blend: {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
    },
  }],
},
```

---

## 2. 混合读的是帧缓冲当前值

后绘制的透明片元 FS 输出会与 **已写入的颜色** 混合。若顺序错误，后到的片元可能该读到的背景不对——Demo 三片交叉四边形在 **固定 draw 顺序** 下会出现明显接缝；**按相机距离从远到近** 排序后改善。

---

## 3. 排序策略

| 方法 | 适用 |
| --- | --- |
| 按物体中心距离排序 | 少量透明 mesh，demo 采用 |
| 按三角形排序 | 更准，CPU 贵 |
| OIT / WBOIT | 大量交叉透明，文档级了解 |

---

## 4. 与批次的配合

整帧顺序建议：

```text
Compute → 不透明 3D → 半透明 3D（排序后）→ UI
```

---

## 5. 延伸阅读

- 上一篇：[05 · 阴影映射](./05-shadow-mapping.md)
- 下一篇：[07 · GPU Instancing](./07-instancing.md)
- [`webgpu-shader.md`](../webgpu-shader.md) §3.5–3.6
