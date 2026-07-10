/**
 * Node.js host: load jco-transpiled wasi-p2-cli-demo and run it with WASI preopens.
 *
 * Mirrors: wasmtime run --dir=./data::/data --env WASI_DEMO=p2 demo.wasm -- [args]
 */
import { configureWasi } from "./setup-wasi.js";

const guestArgs = process.argv.slice(2);
configureWasi(guestArgs);

const { run } = await import("./generated/wasi-p2-cli-demo.js");
run.run();
