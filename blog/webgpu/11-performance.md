# 11 · 性能分析与优化

Demo 规模小、GPU 利用率低是正常的（见 [`webgpu-shader.md`](../webgpu-shader.md) §7）。场景变大后，瓶颈常在 **CPU 录制命令** 与 **管线状态切换**，而非单次 FS 算术。

配套 Demo：[`webgpu-shader-demo/performance/`](../../webgpu-shader-demo/performance/)（`M` 切换 500 draw vs 1 instanced draw）。

---

## 1. 减少 setPipeline / setBindGroup

| 模式 | Draw 数 | 说明 |
| --- | --- | --- |
| 每物体换 bind group | 500 | Demo Mode A |
| Instancing | 1 | Demo Mode B |

合批省的是 **状态切换**，不是合并 API 语义上的多次 draw。

---

## 2. Early-Z 与 overdraw

GPU 可能提前深度测试跳过 FS。不透明场景：先画近处大物体、合理使用 depth write。半透明：仍测深度但通常 **不写深度**，overdraw 成本更高。

---

## 3. 测量

- `performance.now()` 包一层 rAF（Demo HUD 滚动平均）  
- Chrome → Performance → 看 CPU `submit` 与 GPU 队列  
- `timestamp-query`（设备支持时）测 GPU  pass 耗时

---

## 4. 延伸阅读

- 上一篇：[10 · 资源生命周期](./10-resource-lifecycle.md)
- 下一篇：[12 · WGSL 指南](./12-wgsl-guide.md)
