#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WASM="$ROOT/target/wasm32-wasip3/release/wasi-p3-cli-demo.wasm"

if [[ ! -f "$WASM" ]]; then
  cargo +nightly build --target wasm32-wasip3 --release -p wasi-p3-cli-demo
fi

wasmtime run -S preview3=y --dir="$ROOT/data::/data" "$WASM" -- "$@"
