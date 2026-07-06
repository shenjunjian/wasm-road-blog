#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building wasi-p1-cli-demo (wasm32-wasip1)"
cargo build --target wasm32-wasip1 --release -p wasi-p1-cli-demo

echo "==> Building wasi-p2-cli-demo (wasm32-wasip2)"
cargo build --target wasm32-wasip2 --release -p wasi-p2-cli-demo

echo "==> Building wasi-p3-cli-demo (wasm32-wasip3, nightly)"
cargo +nightly build --target wasm32-wasip3 --release -p wasi-p3-cli-demo

echo "==> Done. Artifacts under target/wasm32-wasi*/release/"
