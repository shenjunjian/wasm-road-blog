import { defineConfig } from "vite-plus";

export default defineConfig({
  optimizeDeps: {
    exclude: ["wasm-pack-interaction-demo"],
  },
});
