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
| `wasi-p1-cli-demo` | `wasm32-wasip1` | `wasmtime run` | 骨架 |
| `wasi-p2-cli-demo` | `wasm32-wasip2` | `wasmtime run` + `hosts/jco-p2-host` | 骨架 |
| `wasi-p3-cli-demo` | `wasm32-wasip3` | `wasmtime run -S preview3=y` + `hosts/jco-p3-host` | 骨架 |

## 快速运行（骨架阶段）

当前 crate 为占位实现，完整逻辑将在后续任务中补全。

```bash
# 构建全部（需已安装对应 target）
bash scripts/build-all.sh

# 单独运行 P1
bash scripts/run-p1.sh

# 单独运行 P2
bash scripts/run-p2.sh

# 单独运行 P3（nightly + preview3）
bash scripts/run-p3.sh
```

## 相关文章

- [WASI 基础：从 P1 到 P3 的系统接口与 Component 开发](../blog/wasi-fundamentals.md)（撰写中）
