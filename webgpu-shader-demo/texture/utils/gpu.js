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

/**
 * 单位立方体：24 顶点（每面 4 角、面间不共用）、36 索引（6 面 × 2 三角）。
 * 顶点布局：pos(x,y,z) + uv(u,v)，stride = 5 × float32。
 *
 * ── 顶点 vs UV：两套坐标，经 VS 传到 FS 后 textureSample 用 UV 查贴图 ──
 *
 *   3D 位置 p[i]          2D 贴图坐标 uv[i]（再 *2，见下）
 *   决定「画在屏幕哪」      决定「贴图哪一块颜色」
 *
 * 每个面独立 4 顶点，同一套单位正方形 UV 铺在该面上（以 +Z 前面为例）：
 *
 *        y (+)
 *        ↑
 *   (-1,1) ●──────● (1,1)     贴图侧（UV 未 *2 时）:          贴图侧（*2 后）:
 *          │      │              V↑  (0,1)──(1,1)                  V↑  (0,2)──(2,2)
 *          │  +Z  │               │      │                           │ 2×2 格 │
 *   (-1,-1) ●──────● (1,-1)       └──(0,0)──(1,0)→U                 └──(0,0)──(2,0)→U
 *        x (+) →
 *
 *   p[0..3] 角点顺序与 uv[0..3] 一一对应（indices 每 6 个索引拼成 2 个三角）。
 *
 * ── 为何 uv * 2 ──
 * 原始 uv 范围 [0,1]×[0,1] 刚好铺满贴图一次。乘 2 后变为 [0,2]×[0,2]：
 *   · addressMode = repeat  → UV 超出 1 的部分按小数重复，每面可见 2×2 棋盘格
 *   · addressMode = clamp-to-edge → 超出 1 的 UV 钳在边缘 texel，第二「格」被拉成条带
 * Demo 按 A 切换上述两种模式，便于对比 sampler 行为。
 *
 * 六面在 p / uv 中的分组（每组 4 点，uv 模板相同）：
 *   0–3  +Z 前   4–7  -Z 后   8–11 -X 左   12–15 +X 右   16–19 +Y 上   20–23 -Y 下
 *
 * @returns {{ vertices: Float32Array, indices: Uint16Array }} pos3+uv2
 */
export function createCube() {
  // 24 个角点位置（6 面 × 4 顶点）
  const p = [
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],       // +Z 前
    [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1],   // -Z 后
    [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1],   // -X 左
    [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1],       // +X 右
    [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1],       // +Y 上
    [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],   // -Y 下
  ];
  // 每面同一模板：左下(0,0) 右下(1,0) 右上(1,1) 左上(0,1) —— 与 p 同组 4 点按序配对
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
    verts[i * 5 + 3] = uv[i][0] * 2; // U：0~1 → 0~2，配合 repeat 每面平铺 2 格
    verts[i * 5 + 4] = uv[i][1] * 2; // V：同上
  }
  // 每面 2 三角：(0,1,2)(0,2,3)， winding 与上面 p/uv 角点顺序一致
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
