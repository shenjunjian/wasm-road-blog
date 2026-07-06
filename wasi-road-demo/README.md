# wasi-road-demo

WASI P1 / P2 配套 demo 工程，为 [blog/wasi-fundamentals.md](../blog/wasi-fundamentals.md) 提供可运行示例。

## 文章章节索引

| 文章章节 | 对应 demo / 脚本 |
|----------|------------------|
| 第 2 章 P1 简史 | `crates/wasi-p1-cli-demo` · `scripts/run-p1.sh` |
| 第 5 章 P2 开发 | `crates/wasi-p2-cli-demo` · `scripts/run-p2.sh` |
| 第 8 章 jco 调用 | `hosts/jco-p2-host`（见文章命令） |
| 第 6–7 章 P3 | **无本地 demo**（`wasm32-wasip3` 仅 nightly） |

## 目录结构

```
wasi-road-demo/
├── Cargo.toml              # Cargo workspace 根
├── README.md
├── data/                   # preopen 测试数据
│   └── input.txt
├── crates/
│   ├── wasi-p1-cli-demo/   # P1：wasm32-wasip1 Core Module ✅
│   ├── wasi-p2-cli-demo/   # P2：wasm32-wasip2 Component ✅
│   └── wasi-p3-cli-demo/   # P3：暂缓（需 nightly wasm32-wasip3）
├── hosts/
│   ├── jco-p2-host/        # Node + jco 调用 P2 Component
│   └── jco-p3-host/        # P3：暂缓
└── scripts/
    ├── build-all.sh
    ├── run-p1.sh
    └── run-p2.sh
```

## 前置依赖

| 工具 | 用途 |
|------|------|
| Rust stable | P1 / P2 编译 |
| [wasmtime](https://wasmtime.dev/) | CLI 运行与验证 |
| [wasm-tools](https://github.com/bytecodealliance/wasm-tools) | Component 工具链（可选） |
| Node.js 20+ | jco 宿主（`hosts/`，可选） |

安装 Rust target：

```bash
rustup target add wasm32-wasip1
rustup target add wasm32-wasip2
```

> P3（`wasm32-wasip3`）目前仅在 nightly 提供，本项目 demo 不使用 nightly，P3 内容见文章第 6–7 章官方命令说明。

## 各 demo 职责

| Crate | Target | 验证方式 | 状态 |
|-------|--------|----------|------|
| `wasi-p1-cli-demo` | `wasm32-wasip1` | `wasmtime run` | ✅ 已实现 |
| `wasi-p2-cli-demo` | `wasm32-wasip2` | `wasmtime run` | ✅ 已实现 |
| `wasi-p3-cli-demo` | `wasm32-wasip3` | `wasmtime run -S preview3=y` | ⏸ 暂缓 |

## 快速运行

```bash
# 构建 P1 / P2
cargo build --target wasm32-wasip1 --release -p wasi-p1-cli-demo
cargo build --target wasm32-wasip2 --release -p wasi-p2-cli-demo

# 运行 P1：读 data/input.txt，写 data/output.txt，打印 args/env
bash scripts/run-p1.sh -- hello
wasmtime run --dir=./data::/data --env WASI_DEMO=p1 \
  target/wasm32-wasip1/release/wasi-p1-cli-demo.wasm -- hello

# 运行 P2（产物为 Component）
bash scripts/run-p2.sh -- hello
wasmtime run --dir=./data::/data --env WASI_DEMO=p2 \
  target/wasm32-wasip2/release/wasi-p2-cli-demo.wasm -- hello
```

## 相关文章

- [WASI 基础：从 P1 到 P3 的系统接口与 Component 开发](../blog/wasi-fundamentals.md)
- [Wasm 基础：原理、Rust 编译与 Node 集成](../blog/wasm-fundamentals.md)（姊妹篇）
