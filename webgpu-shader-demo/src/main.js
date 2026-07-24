import {
  createGround,
  createCharacter,
  createWeapon,
  createAuraRing,
} from "./geometry.js";
import { createGpuMesh, createUniformBuffer } from "./mesh.js";
import { createOpaquePipeline } from "./pipelines/opaque.js";
import { createAuraPipeline } from "./pipelines/aura.js";
import { createParticleSystem } from "./pipelines/particles.js";
import { updateSceneTransforms } from "./scene.js";
import { mat4Perspective, mat4LookAt, mat4Multiply, degToRad } from "./math.js";

const DEPTH_FORMAT = "depth24plus";
const CLEAR_COLOR = { r: 0.35, g: 0.55, b: 0.78, a: 1 };

function showError(msg) {
  const el = document.getElementById("error");
  el.textContent = msg;
  el.classList.add("visible");
}

function writeMat4(dst, offset, m) {
  dst.set(m, offset);
}

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  if (!navigator.gpu) {
    showError("当前浏览器不支持 WebGPU。请使用最新版 Chrome 或 Edge。");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    showError("无法获取 GPUAdapter。");
    return;
  }
  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    showError(`GPUDevice lost: ${info.message}`);
  });

  const context = canvas.getContext("webgpu");
  /*format 是画布颜色附件的像素格式（GPUTextureFormat），用来告诉 WebGPU：最终画到屏幕上的那张颜色纹理，每个像素怎么存。
    getPreferredCanvasFormat() 会返回当前平台/浏览器最合适的 canvas 颜色格式，常见是：

    "bgra8unorm"（多数 Windows / macOS）
    "rgba8unorm"（部分 Linux / Android）
    也就是：8 位/通道、归一化、不带 sRGB 标记的那一类。
  */
  const format = navigator.gpu.getPreferredCanvasFormat();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    //configure 不只是“登记 device/format”，还会创建/绑定一块固定尺寸的交换链（swap chain）。窗口变大/变小后：会自动更新颜色纹理的大小。
    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
    return { w, h };
  }

  let { w: width, h: height } = resize();
  window.addEventListener("resize", () => {
    ({ w: width, h: height } = resize());  // 重复解构赋值，必须要外层的括号
    recreateDepth();
  });

  let depthTexture;
  let depthView;

  // 深度纹理也改成同样的新尺寸
  function recreateDepth() {
    if (depthTexture) depthTexture.destroy();
    depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    depthView = depthTexture.createView();
  }
  recreateDepth();

  const groundMesh = createGpuMesh(device, createGround(28));
  const characterMesh = createGpuMesh(device, createCharacter());
  const weaponMesh = createGpuMesh(device, createWeapon());
  const auraMesh = createGpuMesh(device, createAuraRing());

  const opaquePipeline = createOpaquePipeline(device, format, DEPTH_FORMAT);
  const auraPipeline = createAuraPipeline(device, format, DEPTH_FORMAT);
  const particles = createParticleSystem(device, format, DEPTH_FORMAT);

  // Opaque uniform: viewProj(64) + model(64) + light(16) + tint(16) + params(16) = 176 → 176 aligned to 256
  const UNIFORM_SIZE = 256;
  const groundUB = createUniformBuffer(device, UNIFORM_SIZE);
  const charUB = createUniformBuffer(device, UNIFORM_SIZE);
  const weaponUB = createUniformBuffer(device, UNIFORM_SIZE);
  const auraUB = createUniformBuffer(device, 256);
  const auraUB2 = createUniformBuffer(device, 256);

  const groundBG = device.createBindGroup({
    layout: opaquePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: groundUB } }],
  });
  const charBG = device.createBindGroup({
    layout: opaquePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: charUB } }],
  });
  const weaponBG = device.createBindGroup({
    layout: opaquePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: weaponUB } }],
  });
  const auraBG = device.createBindGroup({
    layout: auraPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: auraUB } }],
  });
  const auraBG2 = device.createBindGroup({
    layout: auraPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: auraUB2 } }],
  });

  const eye = [3.2, 2.4, 4.6];
  const target = [0, 0.9, 0];
  const up = [0, 1, 0];

  let lastT = performance.now();

  function fillOpaqueUniform(buffer, viewProj, model, kind, time) {
    const data = new Float32Array(UNIFORM_SIZE / 4);
    writeMat4(data, 0, viewProj);
    writeMat4(data, 16, model);
    data[32] = 0.35;
    data[33] = -1.0;
    data[34] = 0.45;
    data[35] = 0;
    data[36] = 1;
    data[37] = 1;
    data[38] = 1;
    data[39] = 1;
    data[40] = kind;
    data[41] = time;
    data[42] = 0;
    data[43] = 0;
    device.queue.writeBuffer(buffer, 0, data);
  }

  function frame(now) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    const time = now / 1000;

    const aspect = canvas.width / Math.max(canvas.height, 1);
    const proj = mat4Perspective(degToRad(45), aspect, 0.1, 100);
    const view = mat4LookAt(eye, target, up);
    const viewProj = mat4Multiply(proj, view);

    // camera basis for billboards
    const forward = [
      target[0] - eye[0],
      target[1] - eye[1],
      target[2] - eye[2],
    ];
    const fLen = Math.hypot(...forward) || 1;
    const f = forward.map((v) => v / fLen);
    const r = [
      up[1] * f[2] - up[2] * f[1],
      up[2] * f[0] - up[0] * f[2],
      up[0] * f[1] - up[1] * f[0],
    ];
    const rLen = Math.hypot(...r) || 1;
    const right = r.map((v) => v / rLen);
    const camUp = [
      f[1] * right[2] - f[2] * right[1],
      f[2] * right[0] - f[0] * right[2],
      f[0] * right[1] - f[1] * right[0],
    ];

    const { characterModel, weaponModel, auraModel, auraModel2, headWorld } =
      updateSceneTransforms(time);

    fillOpaqueUniform(groundUB, viewProj, identity(), 0, time);
    fillOpaqueUniform(charUB, viewProj, characterModel, 1, time);
    fillOpaqueUniform(weaponUB, viewProj, weaponModel, 2, time);

    device.queue.writeBuffer(
      auraUB,
      0,
      buildAuraUniform(viewProj, auraModel, time),
    );
    device.queue.writeBuffer(
      auraUB2,
      0,
      buildAuraUniform(viewProj, auraModel2, time + 1.0),
    );

    // compute sim params: emitter(16) + timeDelta(16) = 32 bytes
    const sim = new Float32Array(8);
    sim[0] = headWorld[0];
    sim[1] = headWorld[1];
    sim[2] = headWorld[2];
    sim[3] = 0;
    sim[4] = dt;
    sim[5] = time;
    sim[6] = particles.count;
    sim[7] = 0;
    device.queue.writeBuffer(particles.simUniform, 0, sim);

    // viewProj + cameraRight + cameraUp + params = 112 bytes
    const pf = new Float32Array(28);
    writeMat4(pf, 0, viewProj);
    pf[16] = right[0];
    pf[17] = right[1];
    pf[18] = right[2];
    pf[19] = 0;
    pf[20] = camUp[0];
    pf[21] = camUp[1];
    pf[22] = camUp[2];
    pf[23] = 0;
    pf[24] = time;
    device.queue.writeBuffer(particles.frameUniform, 0, pf);

    const encoder = device.createCommandEncoder();

    // 1) Compute particles
    {
      const cpass = encoder.beginComputePass();
      cpass.setPipeline(particles.computePipeline);
      cpass.setBindGroup(0, particles.computeBindGroup);
      cpass.dispatchWorkgroups(Math.ceil(particles.count / 64));
      cpass.end();
    }

    // 2) Render: opaque then transparent
    const colorView = context.getCurrentTexture().createView();
    const rpass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorView,
          clearValue: CLEAR_COLOR,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    rpass.setPipeline(opaquePipeline);

    rpass.setBindGroup(0, groundBG);
    rpass.setVertexBuffer(0, groundMesh.vertexBuffer);
    rpass.setIndexBuffer(groundMesh.indexBuffer, "uint16");
    rpass.drawIndexed(groundMesh.indexCount);

    rpass.setBindGroup(0, charBG);
    rpass.setVertexBuffer(0, characterMesh.vertexBuffer);
    rpass.setIndexBuffer(characterMesh.indexBuffer, "uint16");
    rpass.drawIndexed(characterMesh.indexCount);

    rpass.setBindGroup(0, weaponBG);
    rpass.setVertexBuffer(0, weaponMesh.vertexBuffer);
    rpass.setIndexBuffer(weaponMesh.indexBuffer, "uint16");
    rpass.drawIndexed(weaponMesh.indexCount);

    rpass.setPipeline(auraPipeline);
    rpass.setBindGroup(0, auraBG);
    rpass.setVertexBuffer(0, auraMesh.vertexBuffer);
    rpass.setIndexBuffer(auraMesh.indexBuffer, "uint16");
    rpass.drawIndexed(auraMesh.indexCount);
    rpass.setBindGroup(0, auraBG2);
    rpass.drawIndexed(auraMesh.indexCount);

    rpass.setPipeline(particles.renderPipeline);
    rpass.setBindGroup(0, particles.renderBindGroup);
    rpass.draw(6, particles.count);

    rpass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function buildAuraUniform(viewProj, model, time) {
  // viewProj + model + params(vec4) = 36 floats, pad to 48 for safety / 192 bytes
  const data = new Float32Array(48);
  data.set(viewProj, 0);
  data.set(model, 16);
  data[32] = time;
  data[33] = time;
  data[34] = 0;
  data[35] = 0;
  return data;
}

main().catch((err) => {
  console.error(err);
  showError(String(err?.message || err));
});
