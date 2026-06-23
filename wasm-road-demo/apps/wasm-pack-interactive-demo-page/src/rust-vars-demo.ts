import init, {
  create_delayed_promise,
  create_rust_dom_panel,
  draw_canvas_buffer,
  fetch_resource,
  get_basic_js_values,
  serde_roundtrip,
} from "wasm-pack-interaction-demo";
import heroUrl from "./assets/hero.png?url";

function formatJsValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "bigint") return `${value.toString()} (bigint)`;
  if (value instanceof Promise) return "Promise (pending)";
  try {
    return JSON.stringify(value, (_, v) =>
      typeof v === "bigint" ? `${v.toString()}#bigint` : v,
    )
      .replace(/"(\d+)#bigint"/g, "$1 (bigint)");
  } catch {
    return String(value);
  }
}

function renderPngToCanvas(canvas: HTMLCanvasElement, pngBytes: Uint8Array) {
  const copy = new Uint8Array(pngBytes);
  const blob = new Blob([copy], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export async function runRustVarsDemo() {
  await init();

  const output = document.getElementById("rust-vars-output");
  if (!output) return;

  const lines: string[] = [];

  // 1. 基本 JS 值
  const basic = get_basic_js_values() as Record<string, unknown>;
  console.log("rust var basic====", basic);
  lines.push("【1】基本 JS 值（来自 Rust）");
  for (const [key, val] of Object.entries(basic)) {
    if (val instanceof Promise) {
      const resolved = await val;
      lines.push(`  ${key}: ${formatJsValue(resolved)} (awaited Promise)`);
    } else {
      lines.push(`  ${key}: ${formatJsValue(val)}`);
    }
  }

  // 2. web-sys DOM
  create_rust_dom_panel();
  lines.push("【2】web-sys DOM：已插入 #rust-dom-panel");

  // 3. fetch 图片
  const imgBuffer = (await fetch_resource(heroUrl)) as ArrayBuffer;
  const imgBytes = new Uint8Array(imgBuffer);
  lines.push(`【3】fetch 图片：${imgBytes.byteLength} bytes`);

  const fetchedImg = document.getElementById("rust-fetched-img") as HTMLImageElement;
  if (fetchedImg) {
    const blob = new Blob([new Uint8Array(imgBytes)], { type: "image/png" });
    fetchedImg.src = URL.createObjectURL(blob);
  }

  // 4. serde-wasm-bindgen
  const serdeResult = serde_roundtrip("Alice", 30) as Record<string, unknown>;
  console.log("serdeResult====", serdeResult);
  lines.push("【4】serde-wasm-bindgen 往返：");
  lines.push(`  serialized: ${formatJsValue(serdeResult.serialized)}`);
  lines.push(
    `  deserialized: ${serdeResult.deserializedName}, age=${serdeResult.deserializedAge}`,
  );
  lines.push(`  hobbies: ${formatJsValue(serdeResult.hobbies)}`);

  // 5. js-sys Promise
  const promiseMsg = await create_delayed_promise(800);
  lines.push(`【5】js-sys Promise：${promiseMsg}`);

  // 6. tiny-skia 绘制 → PNG buffer → Canvas
  const pngBytes = draw_canvas_buffer();
  lines.push(`【6】绘制 buffer：PNG ${pngBytes.byteLength} bytes`);
  const skiaCanvas = document.getElementById(
    "rust-skia-canvas",
  ) as HTMLCanvasElement;
  if (skiaCanvas) {
    renderPngToCanvas(skiaCanvas, pngBytes);
  }

  output.textContent = lines.join("\n");
}
