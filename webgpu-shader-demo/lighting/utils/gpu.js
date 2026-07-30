export const DEPTH_FORMAT = "depth24plus";

export function showError(msg) {
  const el = document.getElementById("error");
  if (el) { el.textContent = msg; el.classList.add("visible"); }
}

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
      size: [size.width, size.height], format: DEPTH_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT,
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

/** 八面体 pos3+normal3 */
export function createOctahedron() {
  const v = [
    [0, 1.2, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [0, -1.2, 0],
    [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1],
  ];
  const tris = [
    [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
    [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4],
  ];
  const verts = [];
  const indices = [];
  for (const [a, b, c] of tris) {
    const base = verts.length / 6;
    for (const idx of [a, b, c]) {
      const p = v[idx];
      const len = Math.hypot(p[0], p[1], p[2]) || 1;
      verts.push(p[0], p[1], p[2], p[0] / len, p[1] / len, p[2] / len);
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
