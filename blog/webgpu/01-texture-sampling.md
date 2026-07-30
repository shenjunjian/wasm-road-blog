# 01 · 纹理与采样

上一阶段你已理解：顶点、Uniform 进显存，Fragment Shader 往 **format 匹配** 的颜色附件写像素。本文补上 3D 场景里最常用的一块拼图——**贴图**：把二维图像绑进 Shader，按 UV 采样颜色。

配套 Demo：[`webgpu-shader-demo/texture/`](../../webgpu-shader-demo/texture/)（旋转立方体 + 棋盘格，`F`/`A` 切换采样参数）。

---

## 1. 目标

读完本文你应能：

- 创建 `GPUTexture`、上传像素、创建 `GPUTextureView` 与 `GPUSampler`
- 在 WGSL 里用 `texture_2d` + `sampler` 做 `textureSample`
- 理解 filter 与 addressMode 对视觉效果的影响
- 把贴图 binding 与 Uniform 一起写进 `BindGroup`

---

## 2. Texture 在显存里是什么

[`webgpu-secret.md`](../webgpu-secret.md) 讲过：颜色附件的 `format` 描述每像素布局。贴图同样是 **VRAM 里的二维数组**，只是用途从「写帧缓冲」变成「Shader 只读采样」：

| JS 对象 | 作用 |
| --- | --- |
| `GPUTexture` | 显存里的像素块 + format + mip 层级 |
| `GPUTextureView` | 绑定用的「透镜」（指定哪一层、哪种 aspect） |
| `GPUSampler` | 采样规则：放大/缩小时如何插值、UV 超出边界怎么办 |

创建贴图时 `usage` 必须包含你要做的操作：

```js
const texture = device.createTexture({
  size: [64, 64],
  format: "rgba8unorm",  // 每通道 8bit，Shader 里当 0~1 float
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
});
```

---

## 3. 上传像素

Demo 用 CPU 生成棋盘格，再 `writeTexture`：

```js
device.queue.writeTexture(
  { texture },
  pixels,                      // Uint8Array，RGBA 交错
  { bytesPerRow: 64 * 4 },
  [64, 64],
);
```

也可从 `<img>` 用 `copyExternalImageToTexture`；PNG/JPEG 解码后同样写入显存。

**Mipmap**：缩小时为减少摩尔纹，GPU 可维护 1/2、1/4… 各级预滤波副本。本 demo 未生成 mip；生产环境常设 `mipLevelCount > 1` 并在 `Sampler` 里开 `mipmapFilter: "linear"`。

---

## 4. Sampler：怎么读 texel

```js
device.createSampler({
  magFilter: "linear",      // 放大：邻近 vs 双线性
  minFilter: "linear",
  addressModeU: "repeat",   // U 超出 [0,1]：重复 / 钳制 / 镜像
  addressModeV: "repeat",
});
```

Demo 按 `F`/`A` 在 `nearest`/`linear` 与 `repeat`/`clamp-to-edge` 间切换。立方体 UV 乘 2 后，`repeat` 可看到格子重复；`clamp-to-edge` 则边缘拉伸。

---

## 5. WGSL 侧

```wgsl
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  return textureSample(tex, samp, in.uv);
}
```

- `textureSample`：经 Sampler 插值，最常用
- `textureLoad`：整数 texel 坐标直接读，用于 Compute、后处理精确读写

BindGroup 里 texture 填 `createView()`，sampler 填 `createSampler()` 返回值。

---

## 6. 与顶点 UV 的衔接

[`texture/main.js`](../../webgpu-shader-demo/texture/main.js) 立方体顶点布局：`float32x3` 位置 + `float32x2` UV，与 `VERTEX_LAYOUT` 的 `shaderLocation` 0/1 对应。VS 把 UV 传给 FS，FS 再采样——**几何定义采样坐标，贴图提供颜色**。

---

## 7. 常见错误

| 现象 | 原因 |
| --- | --- |
| Validation：usage 不含 TEXTURE_BINDING | 创建 texture 时漏写 usage |
| 全黑 / 全透明 | BindGroup 里 view/sampler 绑错 binding 号 |
| 花屏 | `bytesPerRow` 未 256 对齐（大行宽时） |
| 锯齿 vs 糊 | filter 选型；缩小时缺 mip |

---

## 8. 延伸阅读

- 下一篇：[02 · 光照模型](./02-lighting.md) — 有法线后可做漫反射与高光
- [WebGPU Fundamentals — Textures](https://webgpufundamentals.org/webgpu/lessons/webgpu-textures.html)
- Demo 源码：[`texture/shaders/main.wgsl`](../../webgpu-shader-demo/texture/shaders/main.wgsl)
