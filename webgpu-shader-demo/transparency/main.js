import shaderCode from "./shaders/main.wgsl?raw";
import {
  initWebGPU,
  showError,
  createPlane,
  createQuad,
  VERTEX_LAYOUT,
  DEPTH_FORMAT,
} from "./utils/gpu.js";
import {
  mat4Multiply,
  mat4Translate,
  mat4RotateX,
  mat4RotateY,
  mat4Perspective,
  mat4LookAt,
  degToRad,
  modelCenter,
  distSq,
} from "./utils/math.js";

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let sorted = false;

  try {
    const { device, context, format, depthView } = await initWebGPU(canvas);

    function uploadMesh(data) {
      const vb = device.createBuffer({
        size: data.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(vb, 0, data.vertices);
      const ib = device.createBuffer({
        size: data.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(ib, 0, data.indices);
      return { vb, ib, count: data.indices.length };
    }

    const floorMesh = uploadMesh(createPlane(8));
    const quadMeshes = [
      uploadMesh(createQuad([1.0, 0.25, 0.25, 0.55])),
      uploadMesh(createQuad([0.25, 0.95, 0.35, 0.55])),
      uploadMesh(createQuad([0.3, 0.45, 1.0, 0.55])),
    ];

    const uniformBuf = device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const module = device.createShaderModule({ code: shaderCode });
    const bgl = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
    });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });

    const opaquePipeline = device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
    });

    const transparentPipeline = device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
      fragment: {
        module,
        entryPoint: "fs_main",
        targets: [{
          format,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "less" },
    });

    const bindGroup = device.createBindGroup({
      layout: bgl,
      entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
    });

    const floorModel = mat4Translate(0, -0.01, 0);
    const quads = [
      { mesh: quadMeshes[0], model: mat4Multiply(mat4RotateY(0), mat4RotateX(Math.PI / 2)), order: 0 },
      { mesh: quadMeshes[1], model: mat4Multiply(mat4RotateY(Math.PI / 2), mat4RotateX(Math.PI / 2)), order: 1 },
      { mesh: quadMeshes[2], model: mat4Multiply(mat4RotateY(Math.PI / 4), mat4RotateX(Math.PI / 2)), order: 2 },
    ];

    const uniformData = new Float32Array(32);

    function updateStatus() {
      statusEl.textContent = sorted
        ? "排序: 按相机距离 back-to-front ✓"
        : "排序: 固定 draw 顺序 ✗（错误）";
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "s" || e.key === "S") {
        sorted = !sorted;
        updateStatus();
      }
    });
    updateStatus();

    let t0 = performance.now();

    function frame(now) {
      const t = (now - t0) * 0.001;
      const aspect = canvas.width / canvas.height;
      const eye = [Math.cos(t * 0.35) * 4, 2.2, Math.sin(t * 0.35) * 4];
      const viewProj = mat4Multiply(
        mat4Perspective(degToRad(50), aspect, 0.1, 50),
        mat4LookAt(eye, [0, 0.5, 0], [0, 1, 0]),
      );

      let drawList = [...quads];
      if (sorted) {
        drawList.sort((a, b) => {
          const ca = modelCenter(b.model);
          const cb = modelCenter(a.model);
          return distSq(ca, eye) - distSq(cb, eye);
        });
      } else {
        drawList.sort((a, b) => a.order - b.order);
      }

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.05, g: 0.07, b: 0.12, a: 1 },
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

      pass.setBindGroup(0, bindGroup);

      pass.setPipeline(opaquePipeline);
      uniformData.set(viewProj, 0);
      uniformData.set(floorModel, 16);
      device.queue.writeBuffer(uniformBuf, 0, uniformData);
      pass.setVertexBuffer(0, floorMesh.vb);
      pass.setIndexBuffer(floorMesh.ib, "uint16");
      pass.drawIndexed(floorMesh.count);

      pass.setPipeline(transparentPipeline);
      for (const q of drawList) {
        uniformData.set(viewProj, 0);
        uniformData.set(q.model, 16);
        device.queue.writeBuffer(uniformBuf, 0, uniformData);
        pass.setVertexBuffer(0, q.mesh.vb);
        pass.setIndexBuffer(q.mesh.ib, "uint16");
        pass.drawIndexed(q.mesh.count);
      }

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
