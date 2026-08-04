# 07 · GPU Instancing

同一 mesh、同一 pipeline，要在屏幕上画 **上千份** 时，与其循环 `drawIndexed` 换 bind group，不如一次 `drawIndexed(indexCount, instanceCount)`，让 GPU 用 `@builtin(instance_index)` 区分实例。

配套 Demo：[`webgpu-shader-demo/instancing/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/webgpu-shader-demo/instancing/)（`I` 切换 instancing / 循环 draw）。

---

## 1. API

```js
pass.drawIndexed(indices.length, undefined, 0, 0, instanceCount);
//                                    ^instanceCount
```

第五个参数即实例数。顶点缓冲不变，**实例数据** 放单独 buffer 或 storage。

---

## 2. WGSL

```wgsl
struct Instance {
  @location(2) offset: vec3f,
  @location(3) color: vec3f,
}

@vertex
fn vs_main(
  @location(0) pos: vec3f,
  inst: Instance,
  @builtin(instance_index) i: u32,
) -> VSOut { /* ... */ }
```

或用 `instance_index` 作 storage 数组下标读 `mat4x4`。

---

## 3. 与合批的关系

Instancing 解决 **同 mesh 多份**；合批还包含「同材质少换 pipeline」。Demo HUD 对比：

- Instancing：**1** draw，10000 实例  
- 循环：**100** draw（避免卡死），每 draw 写不同 uniform

---

## 4. 延伸阅读

- 上一篇：[06 · 透明排序](./06-transparency.md)
- 下一篇：[08 · Compute 进阶](./08-compute-advanced.md)
