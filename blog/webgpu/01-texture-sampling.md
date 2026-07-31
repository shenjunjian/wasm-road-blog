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

## 2. 创建 Texture

[`webgpu-secret.md`](../webgpu-secret.md) 讲过：颜色附件的 `format` 描述每像素布局。贴图同样是 **VRAM 里的二维数组**，只是用途从「写帧缓冲」变成「Shader 只读采样」：

| JS 对象          | 作用                                             |
| ---------------- | ------------------------------------------------ |
| `GPUTexture`     | 显存里的像素块 + format + mip 层级               |
| `GPUTextureView` | 绑定用的「透镜」（指定哪一层、哪种 aspect）      |
| `GPUSampler`     | 采样规则：放大/缩小时如何插值、UV 超出边界怎么办 |

创建贴图时 `usage` 必须包含你要做的操作：

```js
const texSize = 64;
const pixels = createCheckerPixels(texSize);
const texture = device.createTexture({
  size: [64, 64],
  format: "rgba8unorm", // 每通道 8bit，Shader 里当 0~1 float
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
});

device.queue.writeTexture(
  { texture },
  pixels, // Uint8Array，RGBA 交错
  { bytesPerRow: 64 * 4 },
  [64, 64],
);
```

也可从 `<img>` 用 `copyExternalImageToTexture`；PNG/JPEG 解码后同样写入显存。

**Mipmap**：缩小时为减少摩尔纹，GPU 可维护 1/2、1/4… 各级预滤波副本。本 demo 未生成 mip；生产环境常设 `mipLevelCount > 1` 并在 `Sampler` 里开 `mipmapFilter: "linear"`。

---

## 3. 创建 Sampler

```js
device.createSampler({
  magFilter: "linear", // 放大：邻近 vs 双线性
  minFilter: "linear",
  addressModeU: "repeat", // U 超出 [0,1]：重复 / 钳制 / 镜像
  addressModeV: "repeat",
});
```

**Filter**（`magFilter` / `minFilter` / `mipmapFilter`）决定「取哪几个 texel、如何插值」：

| 取值      | 含义                                                           |
| --------- | -------------------------------------------------------------- |
| `nearest` | 取距离采样点最近的单个 texel，放大时像素块感明显，缩小时易锯齿 |
| `linear`  | 在相邻 texel 间双线性插值，过渡更平滑                          |

- `magFilter`：贴图被**放大**（屏幕上一 texel 占多于一个像素）时用
- `minFilter`：贴图被**缩小**（一像素覆盖多个 texel）时用
- `mipmapFilter`：在 mip 层级之间如何过渡；需 texture 有 mip 层级才生效，常与 `minFilter: "linear"` 搭配做三线性过滤

**AddressMode**（`addressModeU` / `addressModeV` / `addressModeW`）决定 UV **超出 [0, 1]** 时怎么办（2D 贴图主要关心 U/V）：

| 取值            | 含义                                             |
| --------------- | ------------------------------------------------ |
| `clamp-to-edge` | 钳制到边缘 texel 颜色，超出部分「拉伸」边缘像素  |
| `repeat`        | 对 UV 取小数部分，纹理平铺重复                   |
| `mirror-repeat` | 平铺且每隔一块镜像翻转，避免 repeat 在接缝处硬切 |

默认值：`magFilter` / `minFilter` / `mipmapFilter` 均为 `nearest`；三个 addressMode 均为 `clamp-to-edge`。

Demo 按 `F`/`A` 在 `nearest`/`linear` 与 `repeat`/`clamp-to-edge` 间切换。立方体 UV 乘 2 后，`repeat` 可看到格子重复；`clamp-to-edge` 则边缘拉伸。

---

## 4. 将texture, sample串联进bindGroup后进入shader

```js
const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "uniform" },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType: "float" },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: { type: "filtering" },
    },
  ],
});
function makeBindGroup() {
  return device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuf } },
      { binding: 1, resource: texture.createView() },
      { binding: 2, resource: makeSampler() },
    ],
  });
}

let bindGroup = makeBindGroup();

function frame(now) {
  //....
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
}
```

## 5. WGSL 侧

```wgsl
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@vertex
fn vs_main(@location(0) pos: vec3f, @location(1) uv: vec2f) -> VSOut {
  var out: VSOut;
  out.position = u.viewProj * u.model * vec4f(pos, 1.0);
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  return textureSample(tex, samp, in.uv);
}
```

- `textureSample`：经 Sampler 插值，最常用
- `textureLoad`：整数 texel 坐标直接读，用于 Compute、后处理精确读写

BindGroup 里 texture 填 `createView()`，sampler 填 `createSampler()` 返回值。

---

## 6. 顺便介绍顶点，uv如何传递（前面介绍过的）

[`texture/main.js`](../../webgpu-shader-demo/texture/main.js) 立方体顶点布局：`float32x3` 位置 + `float32x2` UV，与 `VERTEX_LAYOUT` 的 `shaderLocation` 0/1 对应。VS 把 UV 传给 FS，FS 再采样——**几何定义采样坐标，贴图提供颜色**。

```js
// 1. 顶点 + UV ---> 写入显存
const { vertices, indices } = createCube();
const vb = device.createBuffer({
  size: vertices.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vb, 0, vertices);

// 2. 声明布局
const VERTEX_LAYOUT = {
  arrayStride: 20,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" }, // 顶点
    { shaderLocation: 1, offset: 12, format: "float32x2" }, // UV
  ],
};
const pipeline = device.createRenderPipeline({
  layout: pipelineLayout,
  vertex: { module, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
  // ....
});

function frame(now) {
  //....
  // pass.setPipeline(pipeline);
  // pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, vb);
  pass.setIndexBuffer(ib, "uint16");
  pass.drawIndexed(indices.length);
  pass.end();
}
```

---

## 7. 常见错误

| 现象                                   | 原因                                      |
| -------------------------------------- | ----------------------------------------- |
| Validation：usage 不含 TEXTURE_BINDING | 创建 texture 时漏写 usage                 |
| 全黑 / 全透明                          | BindGroup 里 view/sampler 绑错 binding 号 |
| 花屏                                   | `bytesPerRow` 未 256 对齐（大行宽时）     |
| 锯齿 vs 糊                             | filter 选型；缩小时缺 mip                 |

---

## 8. 延伸阅读

- 下一篇：[02 · 光照模型](./02-lighting.md) — 有法线后可做漫反射与高光
- [WebGPU Fundamentals — Textures](https://webgpufundamentals.org/webgpu/lessons/webgpu-textures.html)
- Demo 源码：[`texture/shaders/main.wgsl`](../../webgpu-shader-demo/texture/shaders/main.wgsl)
