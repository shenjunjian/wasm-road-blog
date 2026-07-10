/**
 * jco run hook: configure preopens/env before the transpiled component loads.
 *
 * Usage: npx jco run --jco-import ./jco-import.js ../../target/.../demo.wasm -- [args]
 */
import { configureWasiForJcoRun } from "./setup-wasi.js";

configureWasiForJcoRun();
