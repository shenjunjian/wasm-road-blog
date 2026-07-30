import { resolve } from "node:path";
import { defineConfig } from "vite";

const demoEntries = [
  "compute",
  "raw",
  "three",
  "texture",
  "lighting",
  "bind-group",
  "postprocess",
  "shadow",
  "transparency",
  "instancing",
  "compute-advanced",
  "skinning",
  "lifecycle",
  "performance",
  "wgsl",
];

/** @type {Record<string, string>} */
const input = { main: resolve(__dirname, "index.html") };
for (const name of demoEntries) {
  input[name] = resolve(__dirname, `${name}/index.html`);
}

export default defineConfig({
  build: {
    rollupOptions: { input },
  },
});
