export const DEPTH_FORMAT = "depth24plus";

export function showError(msg) {
  const el = document.getElementById("error");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
}

/** @param {HTMLCanvasElement} canvas */
export async function initWebGPU(canvas) {
  if (!navigator.gpu) throw new Error("当前浏览器不支持 WebGPU。");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("无法获取 GPUAdapter。");
  const device = await adapter.requestDevice();
  device.lost.then((info) => showError(`GPUDevice lost: ${info.message}`));
  const format = navigator.gpu.getPreferredCanvasFormat();
  const context = canvas.getContext("webgpu");
  const size = { width: 1, height: 1 };
  let depthTexture = null;
  let depthView = null;

  function recreateDepth() {
    if (depthTexture) depthTexture.destroy();
    depthTexture = device.createTexture({
      size: [size.width, size.height],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    depthView = depthTexture.createView();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    size.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    canvas.width = size.width;
    canvas.height = size.height;
    context.configure({ device, format, alphaMode: "opaque" });
    recreateDepth();
  }

  resize();
  window.addEventListener("resize", resize);
  return { device, context, format, get depthView() { return depthView; } };
}

/** @returns {{ vertices: Float32Array, indices: Uint16Array }} */
export function createUnitCube() {
  const p = [
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
    [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5],
    [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5],
    [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
  ];
  const verts = new Float32Array(24 * 3);
  for (let i = 0; i < 24; i++) {
    verts[i * 3] = p[i][0];
    verts[i * 3 + 1] = p[i][1];
    verts[i * 3 + 2] = p[i][2];
  }
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);
  return { vertices: verts, indices };
}

export const VERTEX_LAYOUT = {
  arrayStride: 12,
  attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
};

export const INSTANCE_LAYOUT = {
  arrayStride: 64,
  stepMode: "instance",
  attributes: [
    { shaderLocation: 1, offset: 0, format: "float32x4" },
    { shaderLocation: 2, offset: 16, format: "float32x4" },
    { shaderLocation: 3, offset: 32, format: "float32x4" },
    { shaderLocation: 4, offset: 48, format: "float32x4" },
  ],
};
