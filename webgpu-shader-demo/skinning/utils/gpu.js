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

export const ELBOW_Y = -1.0;

/** pos3 + normal3 + boneIdx2 + weight2 */
const FLOATS_PER_VERTEX = 10;

/**
 * @param {number} cx @param {number} cy @param {number} cz
 * @param {number} hx @param {number} hy @param {number} hz
 * @param {number} w0 @param {number} w1
 */
function boxVerts(cx, cy, cz, hx, hy, hz, w0, w1) {
  const faces = [
    { n: [0, 0, 1], corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [-1, 0, 0], corners: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [1, 0, 0], corners: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [0, 1, 0], corners: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], corners: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
  ];
  /** @type {number[]} */
  const out = [];
  for (const f of faces) {
    for (const c of f.corners) {
      out.push(
        cx + c[0], cy + c[1], cz + c[2],
        f.n[0], f.n[1], f.n[2],
        0, 1, w0, w1,
      );
    }
  }
  return out;
}

/** @returns {{ vertices: Float32Array, indices: Uint16Array }} pos3 + normal3 + boneIdx2 + weight2 */
export function createArmMesh() {
  const upper = boxVerts(0, -0.5, 0, 0.12, 0.5, 0.12, 1, 0);
  const lower = boxVerts(0, ELBOW_Y - 0.425, 0, 0.1, 0.425, 0.1, 0, 1);
  const elbow = boxVerts(0, ELBOW_Y, 0, 0.12, 0.06, 0.12, 0.5, 0.5);
  const raw = [...upper, ...lower, ...elbow];
  const verts = new Float32Array(raw);
  const vCount = verts.length / FLOATS_PER_VERTEX;
  const faceCount = vCount / 4;
  const indices = new Uint16Array(faceCount * 6);
  for (let f = 0; f < faceCount; f++) {
    const i = f * 4;
    const o = f * 6;
    indices[o] = i;
    indices[o + 1] = i + 1;
    indices[o + 2] = i + 2;
    indices[o + 3] = i;
    indices[o + 4] = i + 2;
    indices[o + 5] = i + 3;
  }
  return { vertices: verts, indices };
}

export const VERTEX_LAYOUT = {
  arrayStride: FLOATS_PER_VERTEX * 4,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 3, offset: 32, format: "float32x2" },
  ],
};
