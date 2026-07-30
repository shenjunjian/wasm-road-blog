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
  /** @type {{ width: number, height: number }} */
  const size = { width: 1, height: 1 };
  /** @type {GPUTexture | null} */
  let depthTexture = null;
  /** @type {GPUTextureView | null} */
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
    return size;
  }

  resize();
  window.addEventListener("resize", resize);

  return { device, context, format, get size() { return size; }, get depthView() { return depthView; } };
}

/**
 * 生成 RGBA8 棋盘格像素，供 GPUTexture 的 copyExternalImageToTexture / writeTexture 使用。
 * @returns {Uint8Array} 长度为 size×size×4 的字节数组
 *
 * data 布局（行优先，每像素 4 字节）：
 *   index = (y * size + x) * 4
 *   [R, G, B, A] = data[i..i+3]，各通道 0–255，对应 rgba8unorm
 */
export function createCheckerPixels(size = 64, cells = 8) {
  const data = new Uint8Array(size * size * 4);
  const cell = size / cells;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const odd = (cx + cy) & 1;
      const i = (y * size + x) * 4; // 当前像素在 data 中的起始下标
      data[i] = odd ? 220 : 40;     // R
      data[i + 1] = odd ? 80 : 160; // G
      data[i + 2] = odd ? 60 : 220; // B
      data[i + 3] = 255;            // A（不透明）
    }
  }
  return data;
}

/** @returns {{ vertices: Float32Array, indices: Uint16Array }} pos3+uv2 */
export function createCube() {
  const p = [
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1],
    [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1],
    [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1],
    [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],
  ];
  const uv = [
    [0, 0], [1, 0], [1, 1], [0, 1],
    [0, 0], [1, 0], [1, 1], [0, 1],
    [0, 0], [1, 0], [1, 1], [0, 1],
    [0, 0], [1, 0], [1, 1], [0, 1],
    [0, 0], [1, 0], [1, 1], [0, 1],
    [0, 0], [1, 0], [1, 1], [0, 1],
  ];
  const verts = new Float32Array(24 * 5);
  for (let i = 0; i < 24; i++) {
    verts[i * 5] = p[i][0];
    verts[i * 5 + 1] = p[i][1];
    verts[i * 5 + 2] = p[i][2];
    verts[i * 5 + 3] = uv[i][0] * 2;
    verts[i * 5 + 4] = uv[i][1] * 2;
  }
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);
  return { vertices: verts, indices };
}

export const VERTEX_LAYOUT = {
  arrayStride: 20,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x2" },
  ],
};
