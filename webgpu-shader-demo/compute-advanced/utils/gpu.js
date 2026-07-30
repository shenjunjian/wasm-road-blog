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
    return size;
  }

  resize();
  window.addEventListener("resize", resize);

  return { device, context, format, get size() { return size; } };
}

export const GRID_SIZE = 128;

/** @returns {Uint32Array} */
export function randomSeed(density = 0.28) {
  const n = GRID_SIZE * GRID_SIZE;
  const cells = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    cells[i] = Math.random() < density ? 1 : 0;
  }
  return cells;
}

/** @param {GPUDevice} device @param {Uint32Array} data */
export function createCellBuffer(device, data) {
  const buf = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  device.queue.writeBuffer(buf, 0, data);
  return buf;
}
