# WebGPU Shader Demo

配合博客的可运行 WebGPU 示例集合。

- 渲染原理总览：[`blog/webgpu-shader.md`](../blog/webgpu-shader.md)
- GPU 内部原理：[`blog/webgpu-secret.md`](../blog/webgpu-secret.md)
- **进阶专题系列**：[`blog/webgpu/`](../blog/webgpu/README.md)

## 运行

需要支持 WebGPU 的浏览器（推荐 Chrome / Edge 最新版）。

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址，在首页选择示例。

## 综合示例

| 路径 | 说明 |
| --- | --- |
| `/compute/` | Compute Shader 数组求和，CPU/GPU 结果验证 |
| `/raw/` | 纯 WebGPU：草地、人物、武器、法术环、Compute 粒子 |
| `/three/` | Three.js WebGPURenderer + TSL 对照实现 |

## 专题教程（01–12）

每个文件夹 **完全独立**，不互相 `import`。

| 路径 | 博客 | 主题 |
| --- | --- | --- |
| `/texture/` | [01](../blog/webgpu/01-texture-sampling.md) | 纹理与采样 |
| `/lighting/` | [02](../blog/webgpu/02-lighting.md) | 光照模型 |
| `/bind-group/` | [03](../blog/webgpu/03-bind-group-layout.md) | 显式 BindGroupLayout |
| `/postprocess/` | [04](../blog/webgpu/04-offscreen-postprocess.md) | 离屏渲染与 Bloom |
| `/shadow/` | [05](../blog/webgpu/05-shadow-mapping.md) | 阴影映射 |
| `/transparency/` | [06](../blog/webgpu/06-transparency.md) | 透明排序 |
| `/instancing/` | [07](../blog/webgpu/07-instancing.md) | GPU Instancing |
| `/compute-advanced/` | [08](../blog/webgpu/08-compute-advanced.md) | Conway 生命游戏 |
| `/skinning/` | [09](../blog/webgpu/09-skinning.md) | 骨骼蒙皮 |
| `/lifecycle/` | [10](../blog/webgpu/10-resource-lifecycle.md) | 资源生命周期 |
| `/performance/` | [11](../blog/webgpu/11-performance.md) | 性能与合批 |
| `/wgsl/` | [12](../blog/webgpu/12-wgsl-guide.md) | WGSL 语法展示 |

## 构建

```bash
npm run build
npm run preview
```

`vite.config.js` 已注册全部 HTML 入口，产物在 `dist/` 各子目录。
