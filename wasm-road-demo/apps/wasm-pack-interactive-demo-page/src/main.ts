import "./style.css";
import { runRustVarsDemo } from "./rust-vars-demo.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<section id="wasm-demo">
  <h1>wasm-pack 互操作示例</h1>
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
</section>
`;

runRustVarsDemo().catch((err) => {
  console.error(err);
  const output = document.getElementById("rust-vars-output");
  if (output) {
    output.textContent = `Wasm 初始化失败: ${err}`;
  }
});
