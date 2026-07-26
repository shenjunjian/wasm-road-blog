import computeCode from "../shaders/particles_compute.wgsl?raw";
import renderCode from "../shaders/particles_render.wgsl?raw";

/** 同时存活/模拟的粒子上限（与 compute dispatch、render instance 数一致）。 */
export const PARTICLE_COUNT = 4096;

/**
 * 单粒子在 storage buffer 中的 float 数：
 * pos3 + life + vel3 + seed = 8。
 */
export const PARTICLE_FLOATS = 8;

/**
 * `createParticleSystem` 返回的粒子系统句柄。
 *
 * compute：`particleBuffer`(storage) + `simUniform`；
 * render：同一 `particleBuffer` + `frameUniform`（viewProj / 相机基 / 参数）。
 *
 * @typedef {object} ParticleSystem
 * @property {GPUBuffer} particleBuffer - 粒子 storage（pos/life/vel/seed）
 * @property {GPUBuffer} simUniform - 模拟参数（发射点、dt、time、count）
 * @property {GPUBuffer} frameUniform - 渲染帧参数（viewProj、相机 right/up 等）
 * @property {GPUComputePipeline} computePipeline
 * @property {GPURenderPipeline} renderPipeline - 加色混合、不写深度的广告牌管线
 * @property {GPUBindGroup} computeBindGroup - group0：binding0 粒子，binding1 sim
 * @property {GPUBindGroup} renderBindGroup - group0：binding0 粒子，binding1 frame
 * @property {number} count - 等于 {@link PARTICLE_COUNT}
 */

/**
 * 创建 GPU 粒子系统：初始化 storage、compute/render 管线与 bind group。
 *
 * @param {GPUDevice} device - WebGPU 设备
 * @param {GPUTextureFormat} format - 颜色附件格式（与 canvas 一致）
 * @param {GPUTextureFormat} depthFormat - 深度附件格式（如 `"depth24plus"`）
 * @returns {ParticleSystem}
 */
export function createParticleSystem(device, format, depthFormat) {
  const particleBytes = PARTICLE_COUNT * PARTICLE_FLOATS * 4;
  const particleBuffer = device.createBuffer({
    size: particleBytes,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const initial = new Float32Array(PARTICLE_COUNT * PARTICLE_FLOATS);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const o = i * PARTICLE_FLOATS;
    initial[o + 0] = (Math.random() - 0.5) * 0.2;
    initial[o + 1] = 1.7 + Math.random() * 0.5;
    initial[o + 2] = (Math.random() - 0.5) * 0.2;
    initial[o + 3] = Math.random() * 1.5;
    initial[o + 4] = (Math.random() - 0.5) * 0.1;
    initial[o + 5] = 0.4 + Math.random() * 0.5;
    initial[o + 6] = (Math.random() - 0.5) * 0.1;
    initial[o + 7] = Math.random();
  }
  device.queue.writeBuffer(particleBuffer, 0, initial);

  const simUniform = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const frameUniform = device.createBuffer({
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });


  const particleBuffer = createUniformBuffer(device, particleBytes);
  const computeModule = device.createShaderModule({ code: computeCode });
  const renderModule = device.createShaderModule({ code: renderCode });

  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module: computeModule, entryPoint: "main" },
  });

  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: renderModule,
      entryPoint: "vs_main",
    },
    fragment: {
      module: renderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: false,
      depthCompare: "less",
    },
  });

  const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: simUniform } },
    ],
  });

  const renderBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: frameUniform } },
    ],
  });

  return {
    particleBuffer,
    simUniform,
    frameUniform,
    computePipeline,
    renderPipeline,
    computeBindGroup,
    renderBindGroup,
    count: PARTICLE_COUNT,
  };
}
