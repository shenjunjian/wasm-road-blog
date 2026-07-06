# wasi-road-demo

WASI P1 / P2 / P3 配套 demo 工程，为 [blog/wasi-fundamentals.md](../blog/wasi-fundamentals.md) 提供可运行示例。

## 目录结构

```
wasi-road-demo/
├── Cargo.toml              # Cargo workspace 根
├── README.md
├── data/                   # preopen 测试数据
│   └── input.txt
├── crates/
│   ├── wasi-p1-cli-demo/   # P1：wasm32-wasip1 Core Module
│   ├── wasi-p2-cli-demo/   # P2：wasm32-wasip2 Component
│   └── wasi-p3-cli-demo/   # P3：wasm32-wasip3 async Component
├── hosts/
│   ├── jco-p2-host/        # Node + jco 调用 P2 Component
│   └── jco-p3-host/        # Node + preview3-shim 调用 P3 Component
└── scripts/
    ├── build-all.sh
    ├── run-p1.sh
    ├── run-p2.sh
    └── run-p3.sh
```

## 前置依赖

| 工具 | 用途 |
|------|------|
| Rust stable | P1 / P2 编译 |
| Rust nightly | P3（`wasm32-wasip3`）编译 |
| [wasmtime](https://wasmtime.dev/) | CLI 运行与验证 |
| [wasm-tools](https://github.com/bytecodealliance/wasm-tools) | Component 工具链（P2/P3） |
| Node.js 20+ | jco 宿主（`hosts/`） |

安装 Rust target：

```bash
rustup target add wasm32-wasip1
rustup target add wasm32-wasip2
rustup toolchain install nightly
rustup target add wasm32-wasip3 --toolchain nightly
```

## 各 demo 职责

| Crate | Target | 验证方式 | 状态 |
|-------|--------|----------|------|
| `wasi-p1-cli-demo` | `wasm32-wasip1` | `wasmtime run` | 已实现 |
| `wasi-p2-cli-demo` | `wasm32-wasip2` | `wasmtime run` + `hosts/jco-p2-host` | 已实现 |
| `wasi-p3-cli-demo` | `wasm32-wasip3` | `wasmtime run -S preview3=y` + `hosts/jco-p3-host` | 骨架 |

## 快速运行

```bash
# 构建 P1 / P2
cargo build --target wasm32-wasip1 --release -p wasi-p1-cli-demo
cargo build --target wasm32-wasip2 --release -p wasi-p2-cli-demo

# 运行 P1：读 data/input.txt，写 data/output.txt，打印 args/env
bash scripts/run-p1.sh
wasmtime run --dir=./data::/data --env WASI_DEMO=p1 target/wasm32-wasip1/release/wasi-p1-cli-demo.wasm -- hello

# 运行 P2（产物为 Component）
bash scripts/run-p2.sh
wasmtime run --dir=./data::/data --env WASI_DEMO=p2 target/wasm32-wasip2/release/wasi-p2-cli-demo.wasm -- hello

# 构建全部（含 P3 nightly）
bash scripts/build-all.sh
```

## 相关文章

- [WASI 基础：从 P1 到 P3 的系统接口与 Component 开发](../blog/wasi-fundamentals.md)（撰写中）
