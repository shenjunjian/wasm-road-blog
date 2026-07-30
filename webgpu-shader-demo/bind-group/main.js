import shaderCode from "./shaders/main.wgsl?raw";
import { initWebGPU, showError, createUnitCube, VERTEX_LAYOUT } from "./utils/gpu.js";
import { mat4Multiply, mat4Translate, mat4RotateY, mat4Perspective, mat4LookAt, degToRad } from "./utils/math.js";

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  try {
    const { device, context, format, depthView } = await initWebGPU(canvas);
    const { vertices, indices } = createUnitCube();
    const vb = device.createBuffer({ size: vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, vertices);
    const ib = device.createBuffer({ size: indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ib, 0, indices);

    // 显式 layout：替代 layout: "auto"
    const globalLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
    });
    const objectLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
    });
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [globalLayout, objectLayout],
    });

    const module = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    });

    const globalBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const globalBindGroup = device.createBindGroup({
      layout: globalLayout,
      entries: [{ binding: 0, resource: { buffer: globalBuf } }],
    });

    const configs = [
      { x: -1.5, color: [0.9, 0.35, 0.3], speed: 0.6 },
      { x: 0, color: [0.35, 0.85, 0.5], speed: 0.9 },
      { x: 1.5, color: [0.4, 0.55, 0.95], speed: 1.2 },
    ];
    const objects = configs.map((cfg) => {
      const buf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bindGroup = device.createBindGroup({
        layout: objectLayout,
        entries: [{ binding: 0, resource: { buffer: buf } }],
      });
      return { ...cfg, buf, bindGroup };
    });

    const globalData = new Float32Array(16);
    const objectData = new Float32Array(20);
    let t0 = performance.now();

    function frame(now) {
      const t = (now - t0) * 0.001;
      const aspect = canvas.width / canvas.height;
      const viewProj = mat4Multiply(
        mat4Perspective(degToRad(45), aspect, 0.1, 100),
        mat4LookAt([0, 2, 5], [0, 0, 0], [0, 1, 0]),
      );
      globalData.set(viewProj, 0);
      device.queue.writeBuffer(globalBuf, 0, globalData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0.07, g: 0.09, b: 0.15, a: 1 }, loadOp: "clear", storeOp: "store" }],
        depthStencilAttachment: { view: depthView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" },
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, globalBindGroup);
      pass.setVertexBuffer(0, vb);
      pass.setIndexBuffer(ib, "uint16");

      for (const obj of objects) {
        const model = mat4Multiply(mat4Translate(obj.x, 0, 0), mat4RotateY(t * obj.speed));
        objectData.set(model, 0);
        objectData.set([obj.color[0], obj.color[1], obj.color[2], 1], 16);
        device.queue.writeBuffer(obj.buf, 0, objectData);
        pass.setBindGroup(1, obj.bindGroup);
        pass.drawIndexed(indices.length);
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (e) { showError(String(e.message || e)); }
}

main();
