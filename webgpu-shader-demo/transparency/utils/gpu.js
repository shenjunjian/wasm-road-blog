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

/** pos3 + color4 */
export function createPlane(size = 6) {
  const h = size / 2;
  const verts = new Float32Array([
    -h, 0, -h, 0.35, 0.38, 0.42, 1,
    h, 0, -h, 0.35, 0.38, 0.42, 1,
    h, 0, h, 0.35, 0.38, 0.42, 1,
    -h, 0, h, 0.35, 0.38, 0.42, 1,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return { vertices: verts, indices };
}

/** 单位四边形 pos3 + color4，XY 平面 */
export function createQuad(color) {
  const verts = new Float32Array([
    -0.5, -0.5, 0, color[0], color[1], color[2], color[3],
    0.5, -0.5, 0, color[0], color[1], color[2], color[3],
    0.5, 0.5, 0, color[0], color[1], color[2], color[3],
    -0.5, 0.5, 0, color[0], color[1], color[2], color[3],
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return { vertices: verts, indices };
}

export const VERTEX_LAYOUT = {
  arrayStride: 28,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x4" },
  ],
};
