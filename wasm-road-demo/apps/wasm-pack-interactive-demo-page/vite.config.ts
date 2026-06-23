import { defineConfig } from "vite-plus";

// SharedArrayBuffer 需要 cross-origin isolated 环境
const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  optimizeDeps: {
    exclude: ["wasm-pack-interaction-demo"],
  },
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
});
