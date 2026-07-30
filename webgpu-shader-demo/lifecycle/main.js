import shaderCode from "./shaders/main.wgsl?raw";
import { initWebGPU, showError, createCube, VERTEX_LAYOUT } from "./utils/gpu.js";
import {
  mat4Multiply,
  mat4RotateX,
  mat4RotateY,
  mat4Perspective,
  mat4LookAt,
  degToRad,
} from "./utils/math.js";

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  const statsEl = document.getElementById("stats");
  const recreateBtn = document.getElementById("recreate-depth");

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

    const uniformBuf = device.createBuffer({
      size: 144,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
    });

    const module = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    });

    const uniformData = new Float32Array(36);
    uniformData.set([0.35, 0.65, 0.95, 1], 32);
    let t0 = performance.now();
    let manualRecreateCount = 0;

    function updateHud() {
      statusEl.textContent = `canvas: ${gpu.size.width} × ${gpu.size.height} · depth 重建次数: ${gpu.depthRecreateCount}`;
      statsEl.textContent =
        `GPUBuffer: 3（vertex / index / uniform）· GPUTexture depth: 1 · ` +
        `手动重建: ${manualRecreateCount} · resize 也会触发 destroy + create`;
    }

    recreateBtn.addEventListener("click", () => {
      gpu.recreateDepth();
      manualRecreateCount++;
      updateHud();
    });
    updateHud();

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

    window.addEventListener("resize", updateHud);
  } catch (e) {
    showError(String(e.message || e));
  }
}

main();
