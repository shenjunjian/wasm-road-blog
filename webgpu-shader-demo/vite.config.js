import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        raw: resolve(__dirname, "raw/index.html"),
        three: resolve(__dirname, "three/index.html"),
      },
    },
  },
});
