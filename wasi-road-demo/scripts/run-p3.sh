#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WASM="target/wasm32-wasip3/release/wasi-p3-cli-demo.wasm"

if [[ ! -f "$WASM" ]]; then
  cargo +nightly build --target wasm32-wasip3 --release -p wasi-p3-cli-demo
fi

# Use paths relative to ROOT: wasmtime on Windows cannot resolve Git Bash /d/... paths.
wasmtime run -S preview3=y --dir="./data::/data" "$WASM" -- "$@"
