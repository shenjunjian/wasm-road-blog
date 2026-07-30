import shaderCode from "./shaders/main.wgsl?raw";
import {
  initWebGPU,
  showError,
  createSmallCube,
  buildInstanceData,
  MESH_LAYOUT,
  INSTANCE_LAYOUT,
} from "./utils/gpu.js";
import {
  mat4Multiply,
  mat4Translate,
  mat4RotateY,
  mat4Perspective,
  mat4LookAt,
  degToRad,
} from "./utils/math.js";

const TOTAL_INSTANCES = 10000;
const LOOP_MAX = 100;

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let useInstancing = true;

  try {
    const { device, context, format, depthView } = await initWebGPU(canvas);
    const { vertices, indices } = createSmallCube();

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

    const instanceData = buildInstanceData(TOTAL_INSTANCES);
    const instanceBuf = device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(instanceBuf, 0, instanceData);

    const uniformBuf = device.createBuffer({
      size: 144,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
    const module = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module,
        entryPoint: "vs_main",
        buffers: [MESH_LAYOUT, INSTANCE_LAYOUT],
      },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
    });

    const uniformData = new Float32Array(36);
    let t0 = performance.now();
    let drawCalls = 1;

    function updateStatus() {
      const mode = useInstancing ? "GPU Instancing" : "循环 draw";
      const count = useInstancing ? TOTAL_INSTANCES : LOOP_MAX;
      const note = useInstancing ? "" : "（循环模式最多 100 个实例）";
      statusEl.textContent = `模式: ${mode}${note} · 实例: ${count} · draw call: ${drawCalls}`;
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "i" || e.key === "I") {
        useInstancing = !useInstancing;
        updateStatus();
      }
    });
    updateStatus();

    function frame(now) {
      const t = (now - t0) * 0.001;
      const aspect = canvas.width / canvas.height;
      const viewProj = mat4Multiply(
        mat4Perspective(degToRad(55), aspect, 0.1, 100),
        mat4LookAt([0, 8, 10], [0, 0, 0], [0, 1, 0]),
      );
      const spin = mat4RotateY(t * 0.25);

      const view = useInstancing ? mat4Multiply(viewProj, spin) : viewProj;
      uniformData.set(view, 0);
      uniformData[32] = useInstancing ? 1 : 0;

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
      pass.setVertexBuffer(1, instanceBuf);
      pass.setIndexBuffer(ib, "uint16");

      if (useInstancing) {
        device.queue.writeBuffer(uniformBuf, 0, uniformData);
        pass.drawIndexed(indices.length, TOTAL_INSTANCES);
        drawCalls = 1;
      } else {
        drawCalls = LOOP_MAX;
        for (let i = 0; i < LOOP_MAX; i++) {
          const base = i * 8;
          const ox = instanceData[base];
          const oy = instanceData[base + 1];
          const oz = instanceData[base + 2];
          const model = mat4Multiply(spin, mat4Translate(ox, oy, oz));
          uniformData.set(model, 16);
          uniformData[32] = 0;
          device.queue.writeBuffer(uniformBuf, 0, uniformData);
          pass.drawIndexed(indices.length, 1, 0, 0, i);
        }
      }

      pass.end();
      device.queue.submit([encoder.finish()]);
      updateStatus();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (e) {
    showError(String(e.message || e));
  }
}

main();
