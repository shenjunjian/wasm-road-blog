# WebGPU Shader Demo

配合博客 [`blog/webgpu-shader.md`](../blog/webgpu-shader.md) 的可运行演示：

- 程序化草地地面
- 人物模型 + 手持武器轻微摆动
- 武器环线法术（独立半透明网格）
- 头顶向上飞的粒子（**Compute Shader** 更新）

入口页可手动选择两条实现路径：

| 路径 | 说明 |
|---|---|
| `/raw/` | 纯 WebGPU / WGSL，无框架 |
| `/three/` | Three.js `WebGPURenderer` + TSL 材质 / Compute |

## 运行

需要支持 WebGPU 的浏览器（推荐 Chrome / Edge 最新版）。

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址，在首页选择示例即可。
