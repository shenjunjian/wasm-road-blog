import { defineConfig } from "vize";

export default defineConfig({
  linter: {
    preset: "happy-path",
  },
  typeChecker: {
    enabled: true,
    strict: true,
  },
});
