# 05 · 阴影映射

阴影回答：「这一点是否被光挡住？」经典 **Shadow Mapping**：先从光源视角渲染 **深度图**，主 Pass 里把像素变到光源空间，比较深度。

配套 Demo：[`webgpu-shader-demo/shadow/`](../../webgpu-shader-demo/shadow/)（`1` 无阴影 / `2` 硬阴影 / `3` PCF）。

---

## 1. 两趟 Pass 架构

```text
Shadow Pass:  lightViewProj × model → depth-only → shadowMap
Main Pass:    cameraViewProj × model → FS 采样 shadowMap 比较深度
```

Shadow Pass 只需深度附件，可用 **独立 pipeline**（无 color target 或空 fragment）。

---

## 2. 光源矩阵

方向光常用 **正交投影** `mat4Orthographic` + `lookAt(lightPos, target, up)` 得到 `lightViewProj`。Demo 光源绕场景旋转，阴影随之移动。

---

## 3. 主 Pass 比较

```wgsl
let lightClip = lightViewProj * vec4f(worldPos, 1.0);
let ndc = lightClip.xyz / lightClip.w;
let uv = ndc.xy * 0.5 + 0.5;
let depth = textureSample(shadowMap, shadowSampler, uv).r;
let current = ndc.z * 0.5 + 0.5;
let lit = current - bias <= depth;
```

**Shadow acne**：表面自阴影因浮点精度产生条纹，加 **bias** 把 `current` 略推远。

**PCF**：在 UV 周围 3×3 采样 shadow map 取平均，边缘更软（Demo 模式 3）。

---

## 4. 与 depth format 一致

Shadow map 与 shadow pipeline 的 `depthStencil.format` 必须一致（Demo 用 `depth32float` 或 `depth24plus`）。主 Pass 的 shadow compare  sampler 常用 `compare: "less_equal"`。

---

## 5. 常见错误

- Shadow Pass 未更新与主 Pass 相同的 `model`  
- UV 超出 [0,1] 未 clamp，产生伪影  
- bias 过大 → 彼得潘效应（物体与阴影分离）

---

## 6. 延伸阅读

- 上一篇：[04 · 离屏渲染与后处理](./04-offscreen-postprocess.md)
- 下一篇：[06 · 透明排序](./06-transparency.md)
