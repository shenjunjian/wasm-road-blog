# 08 · Compute 进阶

[`compute/` 基础 demo](../../webgpu-shader-demo/compute/) 用 Compute Shader 做数组求和并读回验证。本文进阶：**网格上的并行模拟**、**ping-pong storage**、以及 Compute 结果供 Render Pass 显示。

配套 Demo：[`webgpu-shader-demo/compute-advanced/`](../../webgpu-shader-demo/compute-advanced/) — Conway 生命游戏 128×128。

---

## 1. Workgroup 与屏障

```wgsl
@compute @workgroup_size(8, 8)
fn update(@builtin(global_invocation_id) gid: vec3u) {
  // 每个 invocation 处理一个 cell
}
```

若需 workgroup 内共享内存：

```wgsl
var<workgroup> tile: array<u32, 64>;
workgroupBarrier();
```

Demo 生命游戏每 cell 读 8 邻居，用 **双 buffer 乒乓**：本帧读 `stateA` 写 `stateB`，下一帧交换。

---

## 2. Storage → 渲染

1. Compute Pass：`dispatchWorkgroups(w/8, h/8)` 更新细胞  
2. Render Pass：全屏 FS 用 `state` buffer 或把 state 复制到 texture 后采样着色

同一 `commandEncoder` 内 **先 compute 后 render**，顺序即同步。

---

## 3. 与粒子 demo 对比

| | compute/ | compute-advanced/ |
| --- | --- | --- |
| 目的 | GPGPU 验证 | 模拟 + 可视化 |
| 读写 | 读回 CPU | 全 GPU 闭环 |
| 渲染 | 无 | 全屏四边形 |

---

## 4. 延伸阅读

- 上一篇：[07 · GPU Instancing](./07-instancing.md)
- 下一篇：[09 · 骨骼动画](./09-skinning.md)
