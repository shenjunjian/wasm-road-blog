import shaderCode from "./shaders/main.wgsl?raw";
import { initWebGPU, showError, createArmMesh, VERTEX_LAYOUT, ELBOW_Y } from "./utils/gpu.js";
import {
  mat4Multiply,
  mat4Translate,
  mat4RotateZ,
  mat4Perspective,
  mat4LookAt,
  mat4Identity,
  degToRad,
} from "./utils/math.js";

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");

  try {
    const { device, context, format, depthView } = await initWebGPU(canvas);
    const { vertices, indices } = createArmMesh();

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
      size: 192,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const module = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
    });

    statusEl.textContent = "bone0 肩 · bone1 肘 · 权重在顶点 buffer";

    const uniformData = new Float32Array(48);
    let t0 = performance.now();

    function frame(now) {
      const t = (now - t0) * 0.001;
      const aspect = canvas.width / canvas.height;
      const viewProj = mat4Multiply(
        mat4Perspective(degToRad(45), aspect, 0.1, 50),
        mat4LookAt([2.2, 0.5, 3.5], [0, -0.8, 0], [0, 1, 0]),
      );

      const bone0 = mat4Identity();
      const elbowPivot = mat4Translate(0, ELBOW_Y, 0);
      const elbowRot = mat4RotateZ(Math.sin(t * 1.4) * 0.85);
      const bone1 = mat4Multiply(elbowPivot, mat4Multiply(elbowRot, mat4Translate(0, -ELBOW_Y, 0)));

      uniformData.set(viewProj, 0);
      uniformData.set(bone0, 16);
      uniformData.set(bone1, 32);

      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.06, g: 0.08, b: 0.14, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
        depthStencilAttachment: {
          view: depthView,
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
