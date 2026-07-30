export const DEPTH_FORMAT = "depth24plus";
export const SHADOW_MAP_SIZE = 2048;

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

/** pos3 + normal3 */
export function createPlane(size = 8) {
  const h = size / 2;
  const n = [0, 1, 0];
  const verts = new Float32Array([
    -h, 0, -h, n[0], n[1], n[2],
    h, 0, -h, n[0], n[1], n[2],
    h, 0, h, n[0], n[1], n[2],
    -h, 0, h, n[0], n[1], n[2],
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return { vertices: verts, indices };
}

export function createUnitCube() {
  const p = [
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
    [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5],
    [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5],
    [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
  ];
  const tris = [
    [0, 1, 2], [0, 2, 3], [4, 5, 6], [4, 6, 7], [8, 9, 10], [8, 10, 11],
    [12, 13, 14], [12, 14, 15], [16, 17, 18], [16, 18, 19], [20, 21, 22], [20, 22, 23],
  ];
  const verts = [];
  const indices = [];
  for (const [a, b, c] of tris) {
    const base = verts.length / 6;
    for (const idx of [a, b, c]) {
      const pt = p[idx];
      verts.push(pt[0], pt[1], pt[2], pt[0], pt[1], pt[2]);
    }
    indices.push(base, base + 1, base + 2);
  }
  return { vertices: new Float32Array(verts), indices: new Uint16Array(indices) };
}

export const VERTEX_LAYOUT = {
  arrayStride: 24,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
  ],
};
