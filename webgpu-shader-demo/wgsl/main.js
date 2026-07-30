import shaderCode from "./shaders/main.wgsl?raw";
import { initWebGPU, showError, FULLSCREEN_VERTICES, FULLSCREEN_LAYOUT } from "./utils/gpu.js";

const EFFECTS = [
  {
    key: "1",
    label: "渐变（mix + sin）",
    desc: "vec3 mix 链与 sin 调制 UV，演示基础向量运算与插值。",
  },
  {
    key: "2",
    label: "噪声（hash + fbm）",
    desc: "hash21 伪随机、valueNoise 插值、fbm 多层叠加 — 典型 procedural 写法。",
  },
  {
    key: "3",
    label: "同心环（length + fract）",
    desc: "极坐标 length、fract 条纹、smoothstep 抗锯齿 — 2D SDF 思路。",
  },
];

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let effectIdx = 0;

  try {
    const { device, context, format } = await initWebGPU(canvas);

    const vb = device.createBuffer({
      size: FULLSCREEN_VERTICES.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vb, 0, FULLSCREEN_VERTICES);

    const uniformBuf = device.createBuffer({
      size: 16,
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
      vertex: { module, entryPoint: "vs_main", buffers: [FULLSCREEN_LAYOUT] },
      fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });

    const uniformData = new ArrayBuffer(16);
    const u32 = new Uint32Array(uniformData);
    const f32 = new Float32Array(uniformData);
    let t0 = performance.now();

    function updateStatus() {
      const fx = EFFECTS[effectIdx];
      statusEl.textContent = `[${fx.key}] ${fx.label} — ${fx.desc}`;
    }

    window.addEventListener("keydown", (e) => {
      const idx = EFFECTS.findIndex((fx) => fx.key === e.key);
      if (idx >= 0) {
        effectIdx = idx;
        updateStatus();
      }
    });
    updateStatus();

    function frame(now) {
      const t = (now - t0) * 0.001;
      const aspect = canvas.width / canvas.height;
      u32[0] = effectIdx;
      f32[1] = t;
      f32[2] = aspect;
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.05, g: 0.07, b: 0.12, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, vb);
      pass.draw(3);
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
