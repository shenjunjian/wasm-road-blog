import opaqueCode from "../shaders/opaque.wgsl?raw";
import { VERTEX_LAYOUT } from "../geometry.js";

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
