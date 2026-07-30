import shadowShader from "./shaders/shadow.wgsl?raw";
import mainShader from "./shaders/main.wgsl?raw";
import {
  initWebGPU,
  showError,
  createPlane,
  createUnitCube,
  VERTEX_LAYOUT,
  DEPTH_FORMAT,
  SHADOW_MAP_SIZE,
} from "./utils/gpu.js";
import {
  mat4Multiply,
  mat4Translate,
  mat4Perspective,
  mat4Orthographic,
  mat4LookAt,
  degToRad,
  normalize3,
} from "./utils/math.js";

const MODES = ["无阴影", "硬阴影", "PCF 软阴影 (3×3)"];

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let shadowMode = 2;

  try {
    const { device, context, format, depthView } = await initWebGPU(canvas);

    const plane = createPlane(10);
    const cube = createUnitCube();

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

    const planeMesh = uploadMesh(plane);
    const cubeMesh = uploadMesh(cube);

    const shadowUniformBuf = device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sceneUniformBuf = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shadowMap = device.createTexture({
      size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const shadowMapView = shadowMap.createView();
    const shadowSampler = device.createSampler({
      compare: "less",
      magFilter: "linear",
      minFilter: "linear",
    });

    const shadowModule = device.createShaderModule({ code: shadowShader });
    const mainModule = device.createShaderModule({ code: mainShader });

    const shadowBgl = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
    });
    const sceneBgl = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } },
      ],
    });

    const shadowPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [shadowBgl] }),
      vertex: { module: shadowModule, entryPoint: "vs_shadow", buffers: [VERTEX_LAYOUT] },
      fragment: { module: shadowModule, entryPoint: "fs_shadow", targets: [] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
    });

    const mainPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [sceneBgl] }),
      vertex: { module: mainModule, entryPoint: "vs_main", buffers: [VERTEX_LAYOUT] },
      fragment: { module: mainModule, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
    });

    const shadowBindGroup = device.createBindGroup({
      layout: shadowBgl,
      entries: [{ binding: 0, resource: { buffer: shadowUniformBuf } }],
    });

    let sceneBindGroup = device.createBindGroup({
      layout: sceneBgl,
      entries: [
        { binding: 0, resource: { buffer: sceneUniformBuf } },
        { binding: 1, resource: shadowMapView },
        { binding: 2, resource: shadowSampler },
      ],
    });

    const objects = [
      { mesh: planeMesh, model: mat4Translate(0, 0, 0), albedo: [0.55, 0.58, 0.62] },
      { mesh: cubeMesh, model: mat4Multiply(mat4Translate(-1.2, 0.5, 0.6), mat4Translate(0, 0.5, 0)), albedo: [0.85, 0.35, 0.3] },
      { mesh: cubeMesh, model: mat4Multiply(mat4Translate(0.8, 0.35, -0.5), mat4Translate(0, 0.35, 0)), albedo: [0.3, 0.65, 0.9] },
      { mesh: cubeMesh, model: mat4Multiply(mat4Translate(0.2, 0.75, 1.0), mat4Translate(0, 0.75, 0)), albedo: [0.9, 0.75, 0.25] },
    ];

    const lightDir = normalize3([-0.45, -1, -0.35]);
    const lightTarget = [0, 0, 0];
    const lightEye = [
      lightTarget[0] - lightDir[0] * 12,
      lightTarget[1] - lightDir[1] * 12,
      lightTarget[2] - lightDir[2] * 12,
    ];
    const lightView = mat4LookAt(lightEye, lightTarget, [0, 1, 0]);
    const lightProj = mat4Orthographic(-5, 5, -5, 5, 2, 25);
    const lightViewProj = mat4Multiply(lightProj, lightView);

    const shadowUniform = new Float32Array(32);
    const sceneUniformBuf_ = new ArrayBuffer(256);
    const sceneUniform = new Float32Array(sceneUniformBuf_);
    const sceneUniformU32 = new Uint32Array(sceneUniformBuf_);

    function updateStatus() {
      statusEl.textContent = `模式: ${MODES[shadowMode]}`;
    }

    window.addEventListener("keydown", (e) => {
      if (e.key >= "1" && e.key <= "3") {
        shadowMode = Number(e.key) - 1;
        updateStatus();
      }
    });
    updateStatus();

    function drawMesh(pass, mesh, bindGroup) {
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, mesh.vb);
      pass.setIndexBuffer(mesh.ib, "uint16");
      pass.drawIndexed(mesh.count);
    }

    const eye = [4.5, 3.5, 5.5];

    function frame() {
      const aspect = canvas.width / canvas.height;
      const viewProj = mat4Multiply(
        mat4Perspective(degToRad(45), aspect, 0.1, 100),
        mat4LookAt(eye, [0, 0.5, 0], [0, 1, 0]),
      );

      const encoder = device.createCommandEncoder();

      const shadowPass = encoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: shadowMapView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      shadowPass.setPipeline(shadowPipeline);
      shadowUniform.set(lightViewProj, 0);
      for (const obj of objects) {
        shadowUniform.set(obj.model, 16);
        device.queue.writeBuffer(shadowUniformBuf, 0, shadowUniform);
        drawMesh(shadowPass, obj.mesh, shadowBindGroup);
      }
      shadowPass.end();

      const mainPass = encoder.beginRenderPass({
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
      mainPass.setPipeline(mainPipeline);

      for (const obj of objects) {
        sceneUniform.set(viewProj, 0);
        sceneUniform.set(obj.model, 16);
        sceneUniform.set(lightViewProj, 32);
        sceneUniform.set([lightDir[0], lightDir[1], lightDir[2], 0], 48);
        sceneUniform.set([obj.albedo[0], obj.albedo[1], obj.albedo[2], 1], 52);
        sceneUniformU32[56] = shadowMode;
        device.queue.writeBuffer(sceneUniformBuf, 0, sceneUniform);
        drawMesh(mainPass, obj.mesh, sceneBindGroup);
      }
      mainPass.end();

      device.queue.submit([encoder.finish()]);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (e) {
    showError(String(e.message || e));
  }
}

main();
