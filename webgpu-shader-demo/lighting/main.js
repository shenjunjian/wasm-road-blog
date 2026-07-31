import shaderCode from "./shaders/main.wgsl?raw";
import { initWebGPU, showError, createOctahedron, VERTEX_LAYOUT } from "./utils/gpu.js";
import { mat4Multiply, mat4RotateX, mat4RotateY, mat4Perspective, mat4LookAt, degToRad, normalize3 } from "./utils/math.js";

const MODES = ["ambient", "ambient + diffuse", "ambient + diffuse + specular"];

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let mode = 2;

  try {
    const gpu = await initWebGPU(canvas);
    const { device, context, format } = gpu;
    const { vertices, indices } = createOctahedron();
    const vb = device.createBuffer({ size: vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, vertices);
    const ib = device.createBuffer({ size: indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ib, 0, indices);

    const uniformBuf = device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const module = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
    });

    window.addEventListener("keydown", (e) => {
      if (e.key >= "1" && e.key <= "3") { mode = Number(e.key) - 1; statusEl.textContent = `模式: ${MODES[mode]}`; }
    });
    statusEl.textContent = `模式: ${MODES[mode]}`;

    const uniformData = new Float32Array(64);
    const eye = [0, 1.5, 4];
    let t0 = performance.now();

    function frame(now) {
      const t = (now - t0) * 0.001;
      const aspect = canvas.width / canvas.height;
      const view = mat4LookAt(eye, [0, 0, 0], [0, 1, 0]);
      const viewProj = mat4Multiply(mat4Perspective(degToRad(45), aspect, 0.1, 100), view);
      const model = mat4Multiply(mat4RotateY(t * 0.5), mat4RotateX(t * 0.25));
      const lightDir = normalize3([Math.cos(t * 0.8), 0.8, Math.sin(t * 0.8)]);

      uniformData.set(viewProj, 0);
      uniformData.set(model, 16);
      uniformData.set([lightDir[0], lightDir[1], lightDir[2], 0], 32);
      uniformData.set([eye[0], eye[1], eye[2], 0], 36);
      uniformData[40] = mode;

      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0.06, g: 0.08, b: 0.14, a: 1 }, loadOp: "clear", storeOp: "store" }],
        depthStencilAttachment: { view: gpu.depthView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" },
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
  } catch (e) { showError(String(e.message || e)); }
}

main();
