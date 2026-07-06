#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WASM="$ROOT/target/wasm32-wasip1/release/wasi-p1-cli-demo.wasm"

if [[ ! -f "$WASM" ]]; then
  cargo build --target wasm32-wasip1 --release -p wasi-p1-cli-demo
fi

wasmtime run --dir="$ROOT/data::/data" "$WASM" -- "$@"
