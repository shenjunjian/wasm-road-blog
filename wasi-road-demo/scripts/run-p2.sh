#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WASM="target/wasm32-wasip2/release/wasi-p2-cli-demo.wasm"

if [[ ! -f "$WASM" ]]; then
  cargo build --target wasm32-wasip2 --release -p wasi-p2-cli-demo
fi

# Use paths relative to ROOT: wasmtime on Windows cannot resolve Git Bash /d/... paths.
wasmtime run --dir="./data::/data" "$WASM" -- "$@"
