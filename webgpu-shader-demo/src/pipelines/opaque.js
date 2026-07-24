import opaqueCode from "../shaders/opaque.wgsl?raw";
import { VERTEX_LAYOUT } from "../geometry.js";

/**
 * 创建不透明物体的渲染管线。
 *
 * 包含：vs_main 顶点着色、fs_main 片元着色、三角形光栅化，
 * 以及开启深度写入的 depth24plus 深度测试（只保留最近表面）。
 *
 * @param {GPUDevice} device - WebGPU 设备
 * @param {GPUTextureFormat} format - 颜色附件格式（通常来自 getPreferredCanvasFormat）
 * @param {GPUTextureFormat} depthFormat - 深度附件格式（如 `"depth24plus"`）
 * @returns {GPURenderPipeline} 不透明渲染管线
 */
export function createOpaquePipeline(device, format, depthFormat) {
  const module = device.createShaderModule({ code: opaqueCode });
  return device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vs_main",
      buffers: [VERTEX_LAYOUT],
    },
    fragment: {
      module,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });
}
