import shaderCode from "./shaders/main.wgsl?raw";
import {
  initWebGPU,
  showError,
  createCheckerPixels,
  createCube,
  VERTEX_LAYOUT,
} from "./utils/gpu.js";
import {
  mat4Multiply,
  mat4RotateX,
  mat4RotateY,
  mat4Perspective,
  mat4LookAt,
  degToRad,
} from "./utils/math.js";

const FILTER_MODES = ["nearest", "linear"];
const ADDRESS_MODES = ["repeat", "clamp-to-edge"];
const TEXTURE_SOURCES = ["checker", "png"];

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let filterIdx = 1;
  let addressIdx = 0;
  let textureIdx = 1;

  try {
    const gpu = await initWebGPU(canvas);
    const { device, context, format } = gpu;

    const { vertices, indices } = createCube();
    const vb = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vb, 0, vertices);

    const ib = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(ib, 0, indices);

    // 纹理数据：CPU 生成棋盘格，或从 PNG 位图加载；按 T 键切换。
    const texSize = 64;
    const pixels = createCheckerPixels(texSize);
    const checkerTexture = device.createTexture({
      size: [texSize, texSize],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture: checkerTexture },
      pixels,
      { bytesPerRow: texSize * 4 },
      [texSize, texSize],
    );

    const texUrl = `/texture.png`;
    const res = await fetch(texUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const pngTexture = device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: pngTexture },
      [bitmap.width, bitmap.height],
    );
    bitmap.close();

    let currentTexture = pngTexture;

    const uniformBuf = device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
    const module = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    function makeSampler() {
      return device.createSampler({
        magFilter: FILTER_MODES[filterIdx],
        minFilter: FILTER_MODES[filterIdx],
        addressModeU: ADDRESS_MODES[addressIdx],
        addressModeV: ADDRESS_MODES[addressIdx],
      });
    }

    function makeBindGroup() {
      return device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: currentTexture.createView() },
          { binding: 2, resource: makeSampler() },
        ],
      });
    }

    let bindGroup = makeBindGroup();

    function updateStatus() {
      statusEl.textContent =
        `texture: ${TEXTURE_SOURCES[textureIdx]} · filter: ${FILTER_MODES[filterIdx]} · address: ${ADDRESS_MODES[addressIdx]}`;
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "t" || e.key === "T") {
        textureIdx = 1 - textureIdx;
        currentTexture = textureIdx === 0 ? checkerTexture : pngTexture;
        bindGroup = makeBindGroup();
        updateStatus();
      }
      if (e.key === "f" || e.key === "F") {
        filterIdx = 1 - filterIdx;
        bindGroup = makeBindGroup();
        updateStatus();
      }
      if (e.key === "a" || e.key === "A") {
        addressIdx = 1 - addressIdx;
        bindGroup = makeBindGroup();
        updateStatus();
      }
    });
    updateStatus();

    const uniformData = new Float32Array(32);
    let t0 = performance.now();

    function frame(now) {
      const aspect = canvas.width / canvas.height;
      const viewProj = mat4Multiply(
        mat4Perspective(degToRad(50), aspect, 0.1, 100),
        mat4LookAt([2.5, 2, 3.5], [0, 0, 0], [0, 1, 0]),
      );
      const t = (now - t0) * 0.001;
      const model = mat4Multiply(mat4RotateY(t * 0.7), mat4RotateX(t * 0.4));
      uniformData.set(viewProj, 0);
      uniformData.set(model, 16);
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.08, g: 0.1, b: 0.16, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
        depthStencilAttachment: {
          view: gpu.depthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, vb);
      pass.setIndexBuffer(ib, "uint16");
      pass.drawIndexed(indices.length);
      pass.end();
      device.queue.submit([encoder.finish()]);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (e) {
    showError(String(e.message || e));
  }
}

main();
