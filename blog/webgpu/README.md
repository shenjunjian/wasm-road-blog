# WebGPU 进阶系列

在掌握 WebGPU 渲染原理与数据传递之后，本系列按主题拆成 12 篇短文，每篇配套 [`webgpu-shader-demo`](../../webgpu-shader-demo/) 中一个**独立可运行**的示例文件夹。

## 前置阅读

建议先读完以下两篇，再按编号顺序学习本系列：

| 文档 | 内容 |
| --- | --- |
| [WebGPU 的渲染原理与 Shader](../webgpu-shader.md) | CPU/GPU 分工、批次、VS/FS、Compute、帧缓冲 |
| [WebGPU 内部运行原理](../webgpu-secret.md) | format、Texture、深度、交换链、GPU 执行视角 |

综合演示（草地 + 人物 + 法术环 + 粒子）见 demo 首页的 **综合示例**：[`raw/`](../../webgpu-shader-demo/raw/)、[`three/`](../../webgpu-shader-demo/three/)、[`compute/`](../../webgpu-shader-demo/compute/)。

## 专题目录

| # | 文章 | Demo |
| --- | --- | --- |
| 01 | [纹理与采样](./01-texture-sampling.md) | [`/texture/`](../../webgpu-shader-demo/texture/) |
| 02 | [光照模型](./02-lighting.md) | [`/lighting/`](../../webgpu-shader-demo/lighting/) |
| 03 | [显式 BindGroupLayout](./03-bind-group-layout.md) | [`/bind-group/`](../../webgpu-shader-demo/bind-group/) |
| 04 | [离屏渲染与后处理](./04-offscreen-postprocess.md) | [`/postprocess/`](../../webgpu-shader-demo/postprocess/) |
| 05 | [阴影映射](./05-shadow-mapping.md) | [`/shadow/`](../../webgpu-shader-demo/shadow/) |
| 06 | [透明排序](./06-transparency.md) | [`/transparency/`](../../webgpu-shader-demo/transparency/) |
| 07 | [GPU Instancing](./07-instancing.md) | [`/instancing/`](../../webgpu-shader-demo/instancing/) |
| 08 | [Compute 进阶](./08-compute-advanced.md) | [`/compute-advanced/`](../../webgpu-shader-demo/compute-advanced/) |
| 09 | [骨骼动画](./09-skinning.md) | [`/skinning/`](../../webgpu-shader-demo/skinning/) |
| 10 | [资源生命周期](./10-resource-lifecycle.md) | [`/lifecycle/`](../../webgpu-shader-demo/lifecycle/) |
| 11 | [性能分析与优化](./11-performance.md) | [`/performance/`](../../webgpu-shader-demo/performance/) |
| 12 | [WGSL 指南](./12-wgsl-guide.md) | [`/wgsl/`](../../webgpu-shader-demo/wgsl/) |

## 运行 Demo

```bash
cd webgpu-shader-demo
npm install
npm run dev
```

浏览器打开终端提示的本地地址，在首页 **专题教程** 区选择对应示例。每个专题文件夹互不 `import`，可单独阅读源码。
