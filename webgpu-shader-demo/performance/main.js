import shaderCode from "./shaders/main.wgsl?raw";
import { initWebGPU, showError, createUnitCube, VERTEX_LAYOUT, INSTANCE_LAYOUT } from "./utils/gpu.js";
import {
  mat4Multiply,
  mat4Translate,
  mat4Scale,
  mat4RotateY,
  mat4Perspective,
  mat4LookAt,
  degToRad,
} from "./utils/math.js";

const INSTANCE_COUNT = 500;
const MODES = [
  { id: "batch", label: "Mode A · 多次 draw", drawCount: INSTANCE_COUNT },
  { id: "instanced", label: "Mode B · Instancing", drawCount: 1 },
];

function buildInstances() {
  const cols = 25;
  const spacing = 0.35;
  const instances = [];
  for (let i = 0; i < INSTANCE_COUNT; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) * 0.5) * spacing;
    const z = (row - (Math.ceil(INSTANCE_COUNT / cols) - 1) * 0.5) * spacing;
    const hue = i / INSTANCE_COUNT;
    const color = [0.35 + hue * 0.55, 0.45, 0.85 - hue * 0.35, 1];
    const model = mat4Multiply(mat4Translate(x, 0, z), mat4Scale(0.12, 0.12, 0.12));
    instances.push({ model, color });
  }
  return instances;
}

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let modeIdx = 0;
  const frameTimes = [];

  try {
    const { device, context, format, depthView } = await initWebGPU(canvas);
    const { vertices, indices } = createUnitCube();
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

    const instances = buildInstances();

    const globalBuf = device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const globalLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
    });
    const globalBindGroup = device.createBindGroup({
      layout: globalLayout,
      entries: [{ binding: 0, resource: { buffer: globalBuf } }],
    });

    const objectLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
    });

    const batchObjects = instances.map((inst) => {
      const buf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const data = new Float32Array(20);
      data.set(inst.model, 0);
      data.set(inst.color, 16);
      device.queue.writeBuffer(buf, 0, data);
      return {
        bindGroup: device.createBindGroup({
          layout: objectLayout,
          entries: [{ binding: 0, resource: { buffer: buf } }],
        }),
      };
    });

    const instanceData = new Float32Array(INSTANCE_COUNT * 16);
    for (let i = 0; i < INSTANCE_COUNT; i++) {
      instanceData.set(instances[i].model, i * 16);
    }
    const instanceBuf = device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(instanceBuf, 0, instanceData);

    const module = device.createShaderModule({ code: shaderCode });
    const depthStencil = { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" };

    const batchPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [globalLayout, objectLayout] }),
      vertex: { module, entryPoint: "vs_batch", buffers: [VERTEX_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil,
    });

    const instancedPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [globalLayout] }),
      vertex: { module, entryPoint: "vs_instanced", buffers: [VERTEX_LAYOUT, INSTANCE_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil,
    });

    const globalData = new Float32Array(16);
    let t0 = performance.now();
    let lastFrame = t0;

    window.addEventListener("keydown", (e) => {
      if (e.key === "m" || e.key === "M") {
        modeIdx = 1 - modeIdx;
        frameTimes.length = 0;
      }
    });

    function updateStatus(frameMs) {
      const mode = MODES[modeIdx];
      statusEl.textContent =
        `${mode.label} · draw: ${mode.drawCount} · 帧时 ~${frameMs.toFixed(2)} ms（滚动平均）`;
    }

    function frame(now) {
      const dt = now - lastFrame;
      lastFrame = now;
      frameTimes.push(dt);
      if (frameTimes.length > 30) frameTimes.shift();
      const avgMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      updateStatus(avgMs);

      const t = (now - t0) * 0.001;
      const aspect = canvas.width / canvas.height;
      const viewProj = mat4Multiply(
        mat4Perspective(degToRad(55), aspect, 0.1, 200),
        mat4LookAt(
          [0, 8 + Math.sin(t * 0.3) * 2, 14],
          [0, 0, 0],
          [0, 1, 0],
        ),
      );
      globalData.set(viewProj, 0);
      device.queue.writeBuffer(globalBuf, 0, globalData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.07, g: 0.09, b: 0.15, a: 1 },
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

      if (modeIdx === 0) {
        pass.setPipeline(batchPipeline);
        pass.setBindGroup(0, globalBindGroup);
        pass.setVertexBuffer(0, vb);
        pass.setIndexBuffer(ib, "uint16");
        for (const obj of batchObjects) {
          pass.setBindGroup(1, obj.bindGroup);
          pass.drawIndexed(indices.length);
        }
      } else {
        pass.setPipeline(instancedPipeline);
        pass.setBindGroup(0, globalBindGroup);
        pass.setVertexBuffer(0, vb);
        pass.setVertexBuffer(1, instanceBuf);
        pass.setIndexBuffer(ib, "uint16");
        pass.drawIndexed(indices.length, INSTANCE_COUNT);
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
