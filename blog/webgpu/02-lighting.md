# 02 · 光照模型

贴图解决「表面是什么颜色」；光照解决「这个颜色在场景里有多亮、哪里反光」。本文从 **Lambert 漫反射** 到 **Blinn-Phong 高光**，全部落在 Fragment Shader 的数学里——不另开渲染通路。

配套 Demo：[`webgpu-shader-demo/lighting/`](../../webgpu-shader-demo/lighting/)（八面体，`1`/`2`/`3` 分步叠加 ambient / diffuse / specular）。

---

## 1. 目标

- 理解法线从模型空间变到世界空间（模型矩阵逆转置）
- 实现方向光漫反射 `max(dot(N, L), 0)`
- 实现 Blinn-Phong 半角向量高光
- 用 Uniform 切换光照分量，便于调试

---

## 2. 法线为什么要特殊变换

顶点携带的 `@location(1) normal` 是 **模型空间** 方向。若模型只有旋转+均匀缩放，可用 `normalize((model * vec4f(normal, 0)).xyz)`（`w=0` 去掉平移）。

非均匀缩放时必须用 **逆转置矩阵** 变法线；demo 八面体只有旋转，故用简化写法。详见 Real-Time Rendering 关于 normal transformation 一节。

---

## 3. 三项光照

设 `N` 法线、`L` 指向光源方向、`V` 指向相机、`H = normalize(L+V)`：

| 项 | 公式 | 作用 |
| --- | --- | --- |
| Ambient | `base * ka` | 模拟间接光，避免背光全黑 |
| Diffuse | `base * kd * max(dot(N,L),0)` | Lambert，受光面亮 |
| Specular | `ks * pow(max(dot(N,H),0), shininess)` | 高光斑 |

Demo WGSL（[`lighting/shaders/main.wgsl`](../../webgpu-shader-demo/lighting/shaders/main.wgsl)）用 `params.x` 控制模式：

- `0`：仅 ambient  
- `1`：+ diffuse  
- `2`：+ specular（shininess=64）

---

## 4. Uniform 打包

```js
// viewProj(16) + model(16) + lightDir(4) + cameraPos(4) + params(4)
uniformData.set(viewProj, 0);
uniformData.set(model, 16);
uniformData.set([lx, ly, lz, 0], 32);
uniformData.set([ex, ey, ez, 0], 36);
uniformData[40] = mode; // 0|1|2
device.queue.writeBuffer(uniformBuf, 0, uniformData);
```

光源方向每帧绕 Y 轴旋转，便于观察高光移动。

---

## 5. 与 PBR 的关系

Blinn-Phong 是经典经验模型。**PBR** 用粗糙度、金属度、菲涅尔等物理启发参数统一漫反射与镜面；底层仍是 FS 里算 `vec3` 颜色。掌握本文三项后，读 LearnOpenGL PBR 章节只是换公式，管线不变。

---

## 6. 常见错误

| 现象 | 原因 |
| --- | --- |
| 整体过暗 | 忘记 ambient；或 `L` 方向与约定反了 |
| 高光位置不对 | `V` 未归一化；相机位置未传入 FS |
| 缩放后光照乱 | 法线未用逆转置 |

---

## 7. 延伸阅读

- 上一篇：[01 · 纹理与采样](./01-texture-sampling.md)
- 下一篇：[03 · 显式 BindGroupLayout](./03-bind-group-layout.md)
- LearnOpenGL：[Basic Lighting](https://learnopengl.com/Lighting/Basic-Lighting)
