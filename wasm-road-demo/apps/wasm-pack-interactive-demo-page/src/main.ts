import "./style.css";
import { runJsVarsDemo } from "./js-vars-demo.ts";
import { runRustVarsDemo } from "./rust-vars-demo.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<section id="wasm-demo">
  <h1>wasm-pack 互操作示例</h1>

  <h2 class="demo-section-title">Rust → JS</h2>
  <p class="demo-desc">Rust 侧 <code>rust-vars.rs</code> 导出变量与函数，由本页 JS 接收并展示。</p>

  <div class="demo-grid">
    <div class="demo-card">
      <h2>1 · 基本 JS 值</h2>
      <pre id="rust-vars-output" class="demo-output">加载中…</pre>
    </div>

    <div class="demo-card">
      <h2>3 · fetch 图片</h2>
      <img id="rust-fetched-img" class="demo-img" alt="Rust fetch 的图片" />
    </div>

    <div class="demo-card">
      <h2>6 · 绘制 buffer → Canvas</h2>
      <p class="demo-hint">tiny-skia 绘制正方形 + helloworld（skia-canvas 的 Wasm 替代方案）</p>
      <canvas id="rust-skia-canvas" class="demo-canvas"></canvas>
    </div>
  </div>

  <h2 class="demo-section-title">JS → Rust</h2>
  <p class="demo-desc">本页 JS 构造值、函数与 buffer，传入 Rust 侧 <code>js-vars.rs</code> 接收并使用。</p>

  <div class="demo-grid">
    <div class="demo-card demo-card-wide">
      <h2>JS 值传入 Rust</h2>
      <pre id="js-vars-output" class="demo-output">加载中…</pre>
    </div>
  </div>
</section>
`;

async function boot() {
  try {
    await runRustVarsDemo();
    await runJsVarsDemo();
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    for (const id of ["rust-vars-output", "js-vars-output"]) {
      const el = document.getElementById(id);
      if (el?.textContent === "加载中…") {
        el.textContent = `Wasm 运行失败: ${message}`;
      }
    }
  }
}

boot();
