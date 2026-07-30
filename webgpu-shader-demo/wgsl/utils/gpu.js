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

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    context.configure({ device, format, alphaMode: "opaque" });
  }

  resize();
  window.addEventListener("resize", resize);
  return { device, context, format };
}

/** 全屏三角形：3 顶点覆盖 NDC，无需 index buffer */
export const FULLSCREEN_VERTICES = new Float32Array([
  -1, -1,
  3, -1,
  -1, 3,
]);

export const FULLSCREEN_LAYOUT = {
  arrayStride: 8,
  attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
};
