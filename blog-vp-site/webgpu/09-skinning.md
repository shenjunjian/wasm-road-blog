# 09 · 骨骼动画

刚性变换（整 mesh 一个 `model` 矩阵）无法表达关节弯曲。**蒙皮（Skinning）** 在 VS 里对每个顶点用多根骨骼的变换矩阵加权混合。

配套 Demo：[`webgpu-shader-demo/skinning/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/webgpu-shader-demo/skinning/) — 双骨骼手臂，`sin(time)` 驱动肘关节。

---

## 1. 顶点数据

除 position 外还需：

- `boneIndices`：影响该顶点的骨骼 id（最多 4 个）  
- `boneWeights`：对应权重，和为 1

Demo 手臂 mesh 在 [`skinning/utils/gpu.js`](https://github.com/shenjunjian/wasm-road-blog/blob/main/webgpu-shader-demo/skinning/utils/gpu.js) 里预置权重。

---

## 2. VS 混合

```wgsl
fn skin(pos: vec3f, idx: vec4u, w: vec4f) -> vec3f {
  var out = vec3f(0.0);
  out += (joint[idx.x] * vec4f(pos, 1.0)).xyz * w.x;
  out += (joint[idx.y] * vec4f(pos, 1.0)).xyz * w.y;
  // ...
  return out;
}
```

`joint[]` 来自 uniform 或 storage，CPU 或动画系统每帧更新 **骨骼世界矩阵**。

---

## 3. CPU vs GPU 算骨骼

| | CPU 算 joint | GPU skinning |
| --- | --- | --- |
| 优点 | 逻辑简单，易调试 | 顶点量大时省 CPU |
| 缺点 | 顶点/upload 多 | Shader 与数据布局复杂 |

现代游戏多在 GPU skinning；Demo 在 CPU 算 2 个 joint 矩阵再 `writeBuffer`。

---

## 4. 延伸阅读

- 上一篇：[08 · Compute 进阶](./08-compute-advanced.md)
- 下一篇：[10 · 资源生命周期](./10-resource-lifecycle.md)
