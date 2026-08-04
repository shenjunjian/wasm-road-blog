---
title: "01 · 模块、包管理与 Cargo.toml"
date: 2026-08-04
tags: [rust, cargo, modules, toml]
description: "Package / Crate / Module 三者关系，文件布局与可见性，以及 Cargo.toml 常用配置详解。"
---

# 01 · 模块、包管理与 Cargo.toml

> 上一篇：[系列导读](./README.md) · 下一篇：[常用数据结构与结构体](./02-collections-structs.md)

中高级 Rust 工程的第一道坎，往往不是算法，而是 **把代码放进正确的模块，并把依赖写进正确的 TOML 字段**。本章把 Package、Crate、Module 三者拆开，再把日常会改的 `Cargo.toml` 配置分类讲透。

---

## 1. Package、Crate、Module

| 概念 | 是什么 | 典型落点 |
| --- | --- | --- |
| **Package** | Cargo 管理的「包」，对应一份 `Cargo.toml` | 仓库根或 workspace 成员目录 |
| **Crate** | 编译单元；每个 crate 有一个根模块 | `src/lib.rs` 或 `src/main.rs`（及 `[[bin]]`） |
| **Module** | crate 内部的命名空间树 | `mod foo;` + `foo.rs` / `foo/mod.rs` |

一个 Package **至少**包含一个 crate，也可以同时有：

- 一个 library crate（`src/lib.rs`）
- 一个或多个 binary crate（`src/main.rs`、`src/bin/*.rs`、或 `[[bin]]` 声明）

```text
my-app/                    # 一个 Package
├── Cargo.toml
└── src/
    ├── lib.rs             # library crate 根（crate 名通常是 my_app）
    ├── main.rs            # 默认 binary crate（同名）
    └── bin/
        └── tool.rs        # 额外 binary：cargo run --bin tool
```

Library 与 Binary 可以互相引用：binary 里写 `use my_app::...`（包名里的 `-` 在 Rust 里变成 `_`）。

---

## 2. 模块树与文件布局

### 2.1 声明模块

在父模块里用 `mod` **声明**子模块；编译器按约定找文件：

```rust
// src/lib.rs
pub mod net;       // → src/net.rs  或  src/net/mod.rs
pub mod storage;   // → src/storage.rs 或 src/storage/mod.rs

pub use net::Client; // 对外 re-export，见后文
```

子模块继续嵌套：

```rust
// src/net.rs  （或 src/net/mod.rs）
pub mod http;
pub mod tcp;

pub struct Client {
    pub host: String,
}
```

```rust
// src/net/http.rs
pub fn get(url: &str) -> String {
    format!("GET {url}")
}
```

路径用法：

```rust
use crate::net::http::get;           // 从当前 crate 根出发
use super::tcp;                      // 从父模块出发
use self::http::get as http_get;     // 从当前模块出发（较少手写 self::）
```

### 2.2 `foo.rs` + `foo/` 与 `mod.rs`

现代 edition（2018+）推荐：

```text
src/
├── lib.rs
└── net/
    ├── mod.rs      # 也可改成 net.rs 放在 src/ 下，子文件仍在 net/
    ├── http.rs
    └── tcp.rs
```

等价的「扁平父文件」写法：

```text
src/
├── lib.rs
├── net.rs          # 内容相当于原来的 net/mod.rs
└── net/
    ├── http.rs
    └── tcp.rs
```

两种布局二选一，不要混用同一模块的 `net.rs` 与 `net/mod.rs`。

### 2.3 `main` 与 `lib` 并存时的模块

`src/main.rs` 是 **另一个 crate 根**，不会自动看到 `lib.rs` 里的私有模块。正确做法是：共享逻辑放进 library，binary 只做入口。

```rust
// src/lib.rs
pub mod config;

pub fn run() {
    let cfg = config::load();
    println!("host = {}", cfg.host);
}
```

```rust
// src/main.rs
fn main() {
    my_app::run();
}
```

```rust
// src/config.rs
pub struct Config {
    pub host: String,
}

pub fn load() -> Config {
    Config {
        host: "127.0.0.1".into(),
    }
}
```

---

## 3. 可见性：`pub` 家族

默认一切 **私有**：父模块能看到子模块名字（因为是你 `mod` 出来的），但看不到子模块内部的私有项。

| 修饰 | 含义 |
| --- | --- |
| （无） | 仅当前模块及子孙可见 |
| `pub` | 对外部 crate 也可见（若路径上各级都 `pub`） |
| `pub(crate)` | 当前 crate 内可见，外部不可见 |
| `pub(super)` | 仅父模块可见 |
| `pub(in path)` | 限定在某祖先模块路径内 |

```rust
// src/lib.rs
mod internal {
    pub(crate) fn helper() -> i32 {
        1
    }

    pub(super) fn only_parent() {}

    // 对外隐藏实现细节
    fn secret() {}
}

pub fn api() -> i32 {
    internal::helper() // OK：同一 crate
}

// 外部 crate 只能调用 api()，不能调用 helper()
```

### 3.1 结构体字段的可见性

`pub struct` 不等于字段公开：

```rust
pub struct User {
    pub id: u64,          // 外部可读写（若有 &mut）
    name: String,         // 外部不可见
}

impl User {
    pub fn new(id: u64, name: impl Into<String>) -> Self {
        Self {
            id,
            name: name.into(),
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }
}
```

### 3.2 Re-export：`pub use`

把深层路径提升到 crate 根，形成稳定公共 API：

```rust
// src/lib.rs
mod net {
    pub mod http {
        pub struct Request;
        pub struct Response;
    }
}

pub use net::http::{Request, Response};

// 外部：use my_app::{Request, Response};
```

---

## 4. Workspace

多包仓库用 workspace 统一依赖解析与 `cargo build`：

```toml
# 仓库根 Cargo.toml
[workspace]
resolver = "2"
members = ["crates/core", "crates/cli", "crates/macros"]
# exclude = ["legacy"]

[workspace.package]
edition = "2021"
license = "MIT"
version = "0.1.0"

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
thiserror = "2"
```

成员包引用 workspace 依赖：

```toml
# crates/core/Cargo.toml
[package]
name = "my-core"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
serde = { workspace = true }
thiserror = { workspace = true }
```

成员之间用 path 依赖：

```toml
# crates/cli/Cargo.toml
[dependencies]
my-core = { path = "../core" }
```

---

## 5. Cargo.toml 常用配置

### 5.1 `[package]`

```toml
[package]
name = "demo-app"           # crates.io / 目录名常用 kebab-case
version = "0.3.1"
edition = "2021"            # 或 "2024"（视工具链）
rust-version = "1.75"       # MSRV 声明（可选）
authors = ["You <you@example.com>"]
license = "MIT OR Apache-2.0"
description = "A demo application"
repository = "https://github.com/example/demo-app"
readme = "README.md"
keywords = ["cli", "demo"]
categories = ["command-line-utilities"]
publish = true              # false 可禁止 publish
```

### 5.2 依赖三段

| 段 | 用途 |
| --- | --- |
| `[dependencies]` | 正常编译进 lib / bin |
| `[dev-dependencies]` | 仅测试、示例、bench |
| `[build-dependencies]` | 仅 `build.rs` |

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[dev-dependencies]
pretty_assertions = "1"
tempfile = "3"

[build-dependencies]
cc = "1"
```

### 5.3 版本约束

```toml
[dependencies]
# 脱糖后多为 ^：兼容 SemVer 的「下一个破坏性主版本之前」
regex = "1.10"
# 等价
regex = "^1.10"

# 精确
foo = "=1.2.3"
# 下限
bar = ">=1.0, <2.0"
# 通配（少用在库上）
baz = "1.*"
```

### 5.4 Features 与 optional 依赖

```toml
[dependencies]
# 可选依赖，默认不启用
reqwest = { version = "0.12", optional = true, default-features = false, features = ["json", "rustls-tls"] }
tokio = { version = "1", optional = true, features = ["rt-multi-thread", "macros"] }

[features]
default = ["std"]
std = []
# 启用 feature 时顺带启用可选依赖
net = ["dep:reqwest", "dep:tokio"]
full = ["net", "std"]
```

代码里用 `cfg`：

```rust
#[cfg(feature = "net")]
pub mod net {
    pub async fn fetch(url: &str) -> reqwest::Result<String> {
        reqwest::get(url).await?.text().await
    }
}

#[cfg(not(feature = "net"))]
pub mod net {
    pub async fn fetch(_url: &str) -> Result<String, &'static str> {
        Err("built without feature `net`")
    }
}
```

依赖方启用：

```toml
demo-app = { version = "0.3", features = ["net"] }
# 或关掉对方的 default features
serde = { version = "1", default-features = false, features = ["derive", "std"] }
```

### 5.5 Path / Git / Rename

```toml
[dependencies]
# 本地路径（开发期常用）
my-core = { path = "../my-core" }

# Git
handy = { git = "https://github.com/example/handy", branch = "main" }
# 或 rev / tag
# handy = { git = "...", rev = "abc1234" }
# handy = { git = "...", tag = "v0.2.0" }

# 重命名：crates.io 包名与 Rust 标识符不同
rust_yaml = { package = "yaml-rust", version = "0.4" }
```

```rust
use rust_yaml::YamlLoader; // 用的是左边的键名
```

### 5.6 `[[bin]]` 与 `[lib]`

```toml
[lib]
name = "demo_app"
path = "src/lib.rs"
# crate-type = ["lib", "cdylib", "staticlib"]  # FFI / 动态库时再开

[[bin]]
name = "demo"
path = "src/main.rs"

[[bin]]
name = "migrate"
path = "src/bin/migrate.rs"
required-features = ["net"]   # 没有 feature 时不编译该 bin
```

未手写时，Cargo 仍会按约定发现 `src/main.rs` 与 `src/bin/*.rs`。

### 5.7 `[profile.*]`

```toml
[profile.dev]
opt-level = 0
debug = true

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"     # 或 "unwind"
strip = "symbols"   # 减小产物

# 依赖在 dev 下也优化一点（例如大 crate）
[profile.dev.package."*"]
opt-level = 2
```

### 5.8 其它实用段

```toml
# 示例：cargo run --example basic
[[example]]
name = "basic"
path = "examples/basic.rs"

# 补丁：临时替换依赖树中的某一包（慎用，勿长期提交）
[patch.crates-io]
serde = { path = "../serde" }

# 目标相关依赖
[target.'cfg(windows)'.dependencies]
winapi = { version = "0.3", features = ["fileapi"] }

[target.'cfg(unix)'.dependencies]
libc = "0.2"
```

---

## 6. 综合示例：库 + 二进制 + 模块树

目录：

```text
shop/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── main.rs
    ├── catalog/
    │   ├── mod.rs
    │   └── price.rs
    └── order.rs
```

```toml
# Cargo.toml
[package]
name = "shop"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }

[features]
default = []
discount = []
```

```rust
// src/lib.rs
pub mod catalog;
pub mod order;

pub use catalog::Item;
pub use order::Order;

pub fn checkout(mut order: Order) -> Order {
    #[cfg(feature = "discount")]
    {
        order.apply_discount(0.1);
    }
    order
}
```

```rust
// src/catalog/mod.rs
mod price;

pub struct Item {
    pub sku: String,
    pub cents: u32,
}

impl Item {
    pub fn new(sku: impl Into<String>, cents: u32) -> Self {
        Self {
            sku: sku.into(),
            cents,
        }
    }

    pub fn label(&self) -> String {
        price::format_cents(self.cents)
    }
}
```

```rust
// src/catalog/price.rs
pub(super) fn format_cents(cents: u32) -> String {
    format!("¥{}.{:02}", cents / 100, cents % 100)
}
```

```rust
// src/order.rs
use crate::catalog::Item;

pub struct Order {
    pub items: Vec<Item>,
}

impl Order {
    pub fn new() -> Self {
        Self { items: Vec::new() }
    }

    pub fn add(&mut self, item: Item) {
        self.items.push(item);
    }

    pub fn total_cents(&self) -> u32 {
        self.items.iter().map(|i| i.cents).sum()
    }

    pub fn apply_discount(&mut self, rate: f64) {
        for item in &mut self.items {
            item.cents = ((item.cents as f64) * (1.0 - rate)) as u32;
        }
    }
}
```

```rust
// src/main.rs
use shop::{checkout, Item, Order};

fn main() {
    let mut order = Order::new();
    order.add(Item::new("book", 4200));
    order.add(Item::new("pen", 300));

    let order = checkout(order);
    println!("total = {} cents", order.total_cents());
    for item in &order.items {
        println!("{} → {}", item.sku, item.label());
    }
}
```

启用折扣 feature：

```bash
cargo run --features discount
```

---

## 7. 易错点

1. **在 `main.rs` 里 `mod` 了一堆，又写了 `lib.rs`**，两边模块树重复、互相看不见——共享代码放进 lib。
2. **`pub use` 漏了**，外部只能写下沉路径，API 一改就全挂。
3. **optional 依赖忘了 `dep:` 或 `features` 映射**，feature 开了但类型解析失败。
4. **workspace 成员写相对 path 依赖时路径算错**（以成员自己的 `Cargo.toml` 为基准）。
5. **包名 `my-app`，代码里却 `use my-app::`**——标识符必须是 `my_app`。

---

## 8. 小结与下一章

本章解决的是「代码与依赖如何组织」。下一章进入 [常用数据结构与结构体](./02-collections-structs.md)：在 `Vec`、`HashMap`、结构体上做增删改时，简单类型（`Copy`）与引用/堆类型（`String`、`Vec`）的行为差异。
