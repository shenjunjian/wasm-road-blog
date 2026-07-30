import lifeCode from "./shaders/life.wgsl?raw";
import renderCode from "./shaders/render.wgsl?raw";
import {
  initWebGPU,
  showError,
  GRID_SIZE,
  randomSeed,
  createCellBuffer,
} from "./utils/gpu.js";
import { clamp } from "./utils/math.js";

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let generation = 0;
  let readFromA = true;
  /** @type {Uint32Array} */
  let cpuCells = randomSeed();

  try {
    const { device, context, format } = await initWebGPU(canvas);
    const cellCount = GRID_SIZE * GRID_SIZE;
    const cellBytes = cellCount * 4;

    let cellsA = createCellBuffer(device, cpuCells);
    let cellsB = device.createBuffer({
      size: cellBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const paramsBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const params = new Float32Array([
      0.25, 0.85, 0.55, 1.0,
      0.04, 0.06, 0.11, 1.0,
    ]);
    device.queue.writeBuffer(paramsBuf, 0, params);

    const computeBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      ],
    });
    const renderBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });

    const computePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [computeBGL] }),
      compute: { module: device.createShaderModule({ code: lifeCode }), entryPoint: "main" },
    });
    const renderPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [renderBGL] }),
      vertex: { module: device.createShaderModule({ code: renderCode }), entryPoint: "vs_main" },
      fragment: { module: device.createShaderModule({ code: renderCode }), entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });

    function makeComputeBG(readBuf, writeBuf) {
      return device.createBindGroup({
        layout: computeBGL,
        entries: [
          { binding: 0, resource: { buffer: readBuf } },
          { binding: 1, resource: { buffer: writeBuf } },
        ],
      });
    }

    function makeRenderBG(readBuf) {
      return device.createBindGroup({
        layout: renderBGL,
        entries: [
          { binding: 0, resource: { buffer: readBuf } },
          { binding: 1, resource: { buffer: paramsBuf } },
        ],
      });
    }

    function syncCpuToGpu() {
      device.queue.writeBuffer(cellsA, 0, cpuCells);
      readFromA = true;
    }

    function reseed() {
      cpuCells = randomSeed();
      generation = 0;
      syncCpuToGpu();
    }

    function toggleAt(canvasX, canvasY) {
      const rect = canvas.getBoundingClientRect();
      const u = clamp((canvasX - rect.left) / rect.width, 0, 1);
      const v = clamp((canvasY - rect.top) / rect.height, 0, 1);
      const gx = Math.min(GRID_SIZE - 1, Math.floor(u * GRID_SIZE));
      const gy = Math.min(GRID_SIZE - 1, Math.floor((1 - v) * GRID_SIZE));
      const idx = gy * GRID_SIZE + gx;
      cpuCells[idx] = cpuCells[idx] ? 0 : 1;
      const buf = readFromA ? cellsA : cellsB;
      device.queue.writeBuffer(buf, idx * 4, new Uint32Array([cpuCells[idx]]));
    }

    canvas.addEventListener("pointerdown", (e) => toggleAt(e.clientX, e.clientY));

    window.addEventListener("keydown", (e) => {
      if (e.key === "r" || e.key === "R") reseed();
    });

    function updateStatus() {
      const alive = cpuCells.reduce((a, b) => a + b, 0);
      statusEl.textContent = `代数: ${generation} · 活细胞: ${alive} · 网格 ${GRID_SIZE}×${GRID_SIZE}`;
    }
    updateStatus();

    function frame() {
      const readBuf = readFromA ? cellsA : cellsB;
      const writeBuf = readFromA ? cellsB : cellsA;

      const encoder = device.createCommandEncoder();

      const computePass = encoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, makeComputeBG(readBuf, writeBuf));
      computePass.dispatchWorkgroups(Math.ceil(GRID_SIZE / 8), Math.ceil(GRID_SIZE / 8));
      computePass.end();

      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.04, g: 0.06, b: 0.11, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, makeRenderBG(writeBuf));
      renderPass.draw(3);
      renderPass.end();

      device.queue.submit([encoder.finish()]);
      readFromA = !readFromA;
      generation++;
      updateStatus();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (e) {
    showError(String(e.message || e));
  }
}

main();
