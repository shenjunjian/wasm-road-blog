/**
 * Configure WASI sandbox (preopens / args / env) before the component loads.
 */
import "./patch-preview2-shim.js";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _setPreopens } from "@bytecodealliance/preview2-shim/filesystem";
import { _appendEnv, _setArgs } from "@bytecodealliance/preview2-shim/cli";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = resolve(__dirname, "../..");

export const dataDir = resolve(demoRoot, "data");
export const wasmPath = resolve(
  demoRoot,
  "target/wasm32-wasip2/release/wasi-p2-cli-demo.wasm",
);

/**
 * @param {string[]} guestArgs CLI args visible to the guest (after program name).
 */
export function configureWasi(guestArgs = []) {
  _setPreopens({ "/data": dataDir });
  _setArgs(["wasi-p2-cli-demo", ...guestArgs]);
  _appendEnv({ WASI_DEMO: "p2" });
}

/** Preopens/env only; keep process.argv from jco run. */
export function configureWasiForJcoRun() {
  _setPreopens({ "/data": dataDir });
  _appendEnv({ WASI_DEMO: "p2" });
}
