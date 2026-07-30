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

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    size.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    canvas.width = size.width;
    canvas.height = size.height;
    context.configure({ device, format, alphaMode: "opaque" });
  }

  resize();
  window.addEventListener("resize", resize);

  return { device, context, format, get size() { return size; } };
}

/** pos3 + color3，每面不同颜色 */
export function createColoredCube() {
  const faces = [
    { idx: [0, 1, 2, 3], color: [1.0, 0.35, 0.25] },
    { idx: [4, 5, 6, 7], color: [0.25, 0.85, 1.0] },
    { idx: [8, 9, 10, 11], color: [0.35, 1.0, 0.45] },
    { idx: [12, 13, 14, 15], color: [1.0, 0.95, 0.3] },
    { idx: [16, 17, 18, 19], color: [1.2, 1.2, 1.5] },
    { idx: [20, 21, 22, 23], color: [0.55, 0.35, 1.0] },
  ];
  const p = [
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1],
    [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1],
    [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1],
    [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],
  ];
  const verts = new Float32Array(24 * 6);
  for (let i = 0; i < 24; i++) {
    const f = faces.find((face) => face.idx.includes(i));
    const c = f.color;
    verts[i * 6] = p[i][0];
    verts[i * 6 + 1] = p[i][1];
    verts[i * 6 + 2] = p[i][2];
    verts[i * 6 + 3] = c[0];
    verts[i * 6 + 4] = c[1];
    verts[i * 6 + 5] = c[2];
  }
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);
  return { vertices: verts, indices };
}

/** 全屏三角形 clip xy */
export function createFullscreenTriangle() {
  return new Float32Array([-1, -1, 3, -1, -1, 3]);
}

export const SCENE_VERTEX_LAYOUT = {
  arrayStride: 24,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
  ],
};

export const FULLSCREEN_VERTEX_LAYOUT = {
  arrayStride: 8,
  attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
};
