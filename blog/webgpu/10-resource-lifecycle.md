# 10 · 资源生命周期

WebGPU 对象（Buffer、Texture、Pipeline）在 JS 里是句柄，显存释放依赖 **`destroy()`** 与 GC。窗口 resize、切换 MSAA、重建 RT 时若漏重建，会出现 validation 错误或画面拉伸。

配套 Demo：[`webgpu-shader-demo/lifecycle/`](../../webgpu-shader-demo/lifecycle/) — 统计 HUD +「重建 Depth」按钮。

---

## 1. resize 清单

[`webgpu-secret.md`](../webgpu-secret.md) 讲过：`context.configure` 会重建 **交换链颜色纹理**，但 **自建的 depth / RT / MSAA** 必须手动：

```js
function onResize(w, h) {
  context.configure({ device, format, alphaMode: "opaque" });
  depthTexture?.destroy();
  depthTexture = device.createTexture({ size: [w, h], /* ... */ });
  offscreenRT?.destroy();
  offscreenRT = createRT(w, h);
}
```

Demo 点击「重建 Depth」模拟这一过程，HUD 显示 `depthRecreateCount`。

---

## 2. destroy 时机

- 确定不再使用的 Texture / Buffer：立即 `destroy()`  
- Pipeline / ShaderModule：长期缓存，除非 hot reload  
- `device.lost`：停止 submit，提示用户刷新

---

## 3. 上传策略

每帧小 Uniform：`queue.writeBuffer` 即可。大网格更新可考虑：

- **双缓冲 staging**：`mapAsync` 写入 → `copyBufferToBuffer`  
- 静态几何：启动时上传一次

---

## 4. 延伸阅读

- 上一篇：[09 · 骨骼动画](./09-skinning.md)
- 下一篇：[11 · 性能分析与优化](./11-performance.md)
