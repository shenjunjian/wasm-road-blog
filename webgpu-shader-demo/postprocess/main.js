import sceneShader from "./shaders/scene.wgsl?raw";
import postShader from "./shaders/post.wgsl?raw";
import compositeShader from "./shaders/composite.wgsl?raw";
import {
  initWebGPU,
  showError,
  createColoredCube,
  createFullscreenTriangle,
  SCENE_VERTEX_LAYOUT,
  FULLSCREEN_VERTEX_LAYOUT,
  DEPTH_FORMAT,
} from "./utils/gpu.js";
import {
  mat4Multiply,
  mat4RotateX,
  mat4RotateY,
  mat4Perspective,
  mat4LookAt,
  degToRad,
} from "./utils/math.js";

async function main() {
  const canvas = document.getElementById("gpu-canvas");
  const statusEl = document.getElementById("status");
  let bloomOn = true;

  try {
    const gpu = await initWebGPU(canvas);
    const { device, context, format } = gpu;

    const { vertices, indices } = createColoredCube();
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

    const fsTri = createFullscreenTriangle();
    const fsVb = device.createBuffer({
      size: fsTri.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(fsVb, 0, fsTri);

    const sceneUniformBuf = device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const postParamsBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const linearSampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

    const sceneModule = device.createShaderModule({ code: sceneShader });
    const postModule = device.createShaderModule({ code: postShader });
    const compositeModule = device.createShaderModule({ code: compositeShader });

    const sceneBgl = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
    });
    const postBgl = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    const compositeBgl = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ],
    });

    const scenePipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [sceneBgl] }),
      vertex: { module: sceneModule, entryPoint: "vs_main", buffers: [SCENE_VERTEX_LAYOUT] },
      fragment: { module: sceneModule, entryPoint: "fs_main", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
    });

    const copyPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [postBgl] }),
      vertex: { module: postModule, entryPoint: "vs_fullscreen", buffers: [FULLSCREEN_VERTEX_LAYOUT] },
      fragment: { module: postModule, entryPoint: "fs_copy", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });

    const extractPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [postBgl] }),
      vertex: { module: postModule, entryPoint: "vs_fullscreen", buffers: [FULLSCREEN_VERTEX_LAYOUT] },
      fragment: { module: postModule, entryPoint: "fs_extract", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list" },
    });

    const blurHPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [postBgl] }),
      vertex: { module: postModule, entryPoint: "vs_fullscreen", buffers: [FULLSCREEN_VERTEX_LAYOUT] },
      fragment: { module: postModule, entryPoint: "fs_blur_h", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list" },
    });

    const blurVPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [postBgl] }),
      vertex: { module: postModule, entryPoint: "vs_fullscreen", buffers: [FULLSCREEN_VERTEX_LAYOUT] },
      fragment: { module: postModule, entryPoint: "fs_blur_v", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list" },
    });

    const compositePipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [compositeBgl] }),
      vertex: { module: compositeModule, entryPoint: "vs_fullscreen", buffers: [FULLSCREEN_VERTEX_LAYOUT] },
      fragment: { module: compositeModule, entryPoint: "fs_composite", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });

    /** @type {GPUTexture | null} */
    let sceneColor = null;
    /** @type {GPUTexture | null} */
    let sceneDepth = null;
    /** @type {GPUTexture | null} */
    let bloomBright = null;
    /** @type {GPUTexture | null} */
    let bloomBlurH = null;
    /** @type {GPUTexture | null} */
    let bloomBlurV = null;

    let sceneBindGroup = null;
    let copyBg = null;
    let extractBg = null;
    let blurHBg = null;
    let blurVBg = null;
    let compositeBg = null;

    function recreateTargets() {
      const { width, height } = gpu.size;
      for (const t of [sceneColor, sceneDepth, bloomBright, bloomBlurH, bloomBlurV]) {
        if (t) t.destroy();
      }
      sceneColor = device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      sceneDepth = device.createTexture({
        size: [width, height],
        format: DEPTH_FORMAT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      bloomBright = device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      bloomBlurH = device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      bloomBlurV = device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });

      sceneBindGroup = device.createBindGroup({
        layout: sceneBgl,
        entries: [{ binding: 0, resource: { buffer: sceneUniformBuf } }],
      });

      const postParams = new Float32Array([1 / width, 1 / height, 0, 0]);
      device.queue.writeBuffer(postParamsBuf, 0, postParams);

      copyBg = device.createBindGroup({
        layout: postBgl,
        entries: [
          { binding: 0, resource: sceneColor.createView() },
          { binding: 1, resource: linearSampler },
          { binding: 2, resource: { buffer: postParamsBuf } },
        ],
      });
      extractBg = device.createBindGroup({
        layout: postBgl,
        entries: [
          { binding: 0, resource: sceneColor.createView() },
          { binding: 1, resource: linearSampler },
          { binding: 2, resource: { buffer: postParamsBuf } },
        ],
      });
      blurHBg = device.createBindGroup({
        layout: postBgl,
        entries: [
          { binding: 0, resource: bloomBright.createView() },
          { binding: 1, resource: linearSampler },
          { binding: 2, resource: { buffer: postParamsBuf } },
        ],
      });
      blurVBg = device.createBindGroup({
        layout: postBgl,
        entries: [
          { binding: 0, resource: bloomBlurH.createView() },
          { binding: 1, resource: linearSampler },
          { binding: 2, resource: { buffer: postParamsBuf } },
        ],
      });
      compositeBg = device.createBindGroup({
        layout: compositeBgl,
        entries: [
          { binding: 0, resource: sceneColor.createView() },
          { binding: 1, resource: bloomBlurV.createView() },
          { binding: 2, resource: linearSampler },
        ],
      });
    }

    recreateTargets();
    window.addEventListener("resize", recreateTargets);

    function updateStatus() {
      statusEl.textContent = `Bloom: ${bloomOn ? "开" : "关"}`;
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "b" || e.key === "B") {
        bloomOn = !bloomOn;
        updateStatus();
      }
    });
    updateStatus();

    const uniformData = new Float32Array(32);
    let t0 = performance.now();

    function drawFullscreen(pass, pipeline, bindGroup) {
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, fsVb);
      pass.draw(3);
    }

    function frame(now) {
      const aspect = canvas.width / canvas.height;
      const viewProj = mat4Multiply(
        mat4Perspective(degToRad(50), aspect, 0.1, 100),
        mat4LookAt([2.8, 2.2, 3.8], [0, 0, 0], [0, 1, 0]),
      );
      const t = (now - t0) * 0.001;
      const model = mat4Multiply(mat4RotateY(t * 0.7), mat4RotateX(t * 0.45));
      uniformData.set(viewProj, 0);
      uniformData.set(model, 16);
      device.queue.writeBuffer(sceneUniformBuf, 0, uniformData);

      const encoder = device.createCommandEncoder();

      const scenePass = encoder.beginRenderPass({
        colorAttachments: [{
          view: sceneColor.createView(),
          clearValue: { r: 0.04, g: 0.06, b: 0.1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
        depthStencilAttachment: {
          view: sceneDepth.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      scenePass.setPipeline(scenePipeline);
      scenePass.setBindGroup(0, sceneBindGroup);
      scenePass.setVertexBuffer(0, vb);
      scenePass.setIndexBuffer(ib, "uint16");
      scenePass.drawIndexed(indices.length);
      scenePass.end();

      if (bloomOn) {
        const extractPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: bloomBright.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        drawFullscreen(extractPass, extractPipeline, extractBg);
        extractPass.end();

        const blurHPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: bloomBlurH.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        drawFullscreen(blurHPass, blurHPipeline, blurHBg);
        blurHPass.end();

        const blurVPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: bloomBlurV.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        drawFullscreen(blurVPass, blurVPipeline, blurVBg);
        blurVPass.end();

        const outPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        drawFullscreen(outPass, compositePipeline, compositeBg);
        outPass.end();
      } else {
        const outPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        drawFullscreen(outPass, copyPipeline, copyBg);
        outPass.end();
      }

      device.queue.submit([encoder.finish()]);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (e) {
    showError(String(e.message || e));
  }
}

main();
