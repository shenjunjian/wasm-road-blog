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

/** @returns {{ vertices: Float32Array, indices: Uint16Array }} pos3 only, unit cube */
export function createSmallCube() {
  const s = 0.04;
  const p = [
    [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
    [s, -s, -s], [-s, -s, -s], [-s, s, -s], [s, s, -s],
    [-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s],
    [s, -s, s], [s, -s, -s], [s, s, -s], [s, s, s],
    [-s, s, s], [s, s, s], [s, s, -s], [-s, s, -s],
    [-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s],
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

export const MESH_LAYOUT = {
  arrayStride: 12,
  stepMode: "vertex",
  attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
};

export const INSTANCE_LAYOUT = {
  arrayStride: 32,
  stepMode: "instance",
  attributes: [
    { shaderLocation: 1, offset: 0, format: "float32x3" },
    { shaderLocation: 2, offset: 16, format: "float32x4" },
  ],
};

/** @param {number} count @returns {Float32Array} offset.xyz + pad + color.rgba per instance */
export function buildInstanceData(count) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const spacing = 0.12;
  const data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++) {
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    const ox = (cx - (cols - 1) * 0.5) * spacing;
    const oz = (cy - (rows - 1) * 0.5) * spacing;
    const hue = (i / count) * 360;
    const rgb = hslToRgb(hue, 0.65, 0.55);
    const base = i * 8;
    data[base] = ox;
    data[base + 1] = 0;
    data[base + 2] = oz;
    data[base + 3] = 0;
    data[base + 4] = rgb[0];
    data[base + 5] = rgb[1];
    data[base + 6] = rgb[2];
    data[base + 7] = 1;
  }
  return data;
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c * 0.5;
  return [r + m, g + m, b + m];
}
