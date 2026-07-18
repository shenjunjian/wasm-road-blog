import computeCode from "../shaders/particles_compute.wgsl?raw";
import renderCode from "../shaders/particles_render.wgsl?raw";

export const PARTICLE_COUNT = 4096;
/** Particle: pos3 + life + vel3 + seed = 8 floats */
export const PARTICLE_FLOATS = 8;

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
