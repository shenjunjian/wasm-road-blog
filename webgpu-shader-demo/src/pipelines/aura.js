import auraCode from "../shaders/aura.wgsl?raw";
import { VERTEX_LAYOUT } from "../geometry.js";

export function createAuraPipeline(device, format, depthFormat) {
  const module = device.createShaderModule({ code: auraCode });
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
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: false,
      depthCompare: "less",
    },
  });
}
