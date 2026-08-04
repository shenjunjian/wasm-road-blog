---
name: Rust 中高级教程
overview: 在 blog/rust-lang/ 下撰写一套 Rust 中高级系列博文（无独立 demo），按用户指定的 6 个主题拆章，示例代码详尽，风格对标现有 webgpu / rust-tools 系列。
todos:
  - id: readme
    content: 撰写 blog/rust-lang/README.md 系列导读与章节索引
    status: completed
  - id: ch01
    content: 撰写 01-modules-cargo.md — 模块、包、Cargo.toml 常用配置
    status: completed
  - id: ch02
    content: 撰写 02-collections-structs.md — Vec/HashMap/结构体与所有权修改场景
    status: completed
  - id: ch03
    content: 撰写 03-pointers.md — 引用与智能指针全家桶
    status: completed
  - id: ch04
    content: 撰写 04-traits.md — 标准 Trait 分类与 dyn/vtable 内存布局
    status: completed
  - id: ch05
    content: 撰写 05-option-result.md — Option/Result 与 ?/if let 等语法
    status: completed
  - id: ch06
    content: 撰写 06-async-threads.md — 多线程与 async/await（Tokio）
    status: completed
isProject: false
---

# Rust 中高级学习教程

## 交付形式

按仓库惯例拆成 **系列分章**（与 [blog/rust-tools/](blog/rust-tools/)、[blog/webgpu/](blog/webgpu/) 一致），目录：

```
blog/rust-lang/
├── README.md              # 系列导读、阅读顺序、章节索引
├── 01-modules-cargo.md    # 模块、包管理与 Cargo.toml
├── 02-collections-structs.md  # 常用数据结构与结构体
├── 03-pointers.md         # 引用与智能指针
├── 04-traits.md           # Trait 分类与内存布局
├── 05-option-result.md    # Option / Result 与相关语法
└── 06-async-threads.md    # 异步与多线程
```

- **无演示工程**（按你的要求）；所有示例以文内可编译片段为主，必要时注明依赖（如 `tokio`）。
- 定位：**中高级**——默认读者已会变量、函数、基础所有权；不写 Hello World / 安装教程。
- 文风：简体中文，完整句子，表格 + 详尽代码块，对标 [blog/wasm-fundamentals.md](blog/wasm-fundamentals.md) 的深度，但按章拆开便于阅读。
- 每篇可选 YAML frontmatter（`title` / `date` / `tags` / `description`），与长文一致。

```mermaid
flowchart LR
  readme[README]
  m01[01 Modules Cargo]
  m02[02 Collections]
  m03[03 Pointers]
  m04[04 Traits]
  m05[05 Option Result]
  m06[06 Async Threads]
  readme --> m01 --> m02 --> m03 --> m04 --> m05 --> m06
  m02 -.-> m03
  m03 -.-> m04
  m04 -.-> m05
```

---

## 各章纲要

### README.md

- 系列目标与读者画像
- 建议阅读顺序（上图）
- 章节索引表
- 明确范围外：宏、unsafe 深度、FFI、测试框架、生命周期专题独立篇等（生命周期只在指针/结构体章按需穿插）

### 01 — 模块、包管理与 TOML

文件：[blog/rust-lang/01-modules-cargo.md](blog/rust-lang/01-modules-cargo.md)

- **包 / Crate / Module** 三者关系（`package` → 一个或多个 crate；`mod` / `use` / `pub`）
- 文件布局：`mod.rs` vs `foo.rs` + `foo/`、`src/lib.rs` vs `src/main.rs`、workspace 成员
- 可见性：`pub`、`pub(crate)`、`pub(super)`、re-export（`pub use`）
- **Cargo.toml 常用配置**（分类讲，配完整片段）：
  - `[package]`：name、version、edition、authors、license
  - `[dependencies]` / `[dev-dependencies]` / `[build-dependencies]`
  - 版本约束、features、`optional`、`default-features`
  - 路径 / git / rename（`package =`）依赖
  - `[features]`、`[[bin]]`、`[lib]`、`[profile.*]`、`[workspace]`
- 示例：多模块库 + binary 的目录树与对应 `mod`/`use` 代码

### 02 — 常用数据结构与结构体

文件：[blog/rust-lang/02-collections-structs.md](blog/rust-lang/02-collections-structs.md)

- **Vec**：创建、索引、`push`/`pop`、`insert`/`remove`/`swap_remove`、迭代中修改的陷阱、`drain`、切片
- **HashMap / HashSet**：插入、更新（`entry` API）、删除、遍历；key 需 `Eq + Hash`
- 简述 **BTreeMap**、**VecDeque**、**String` vs `&str`（与集合交叉处）
- **结构体**：命名结构体、元组结构体、unit；字段读写；`impl` 方法与关联函数
- **所有权场景对比**（本章重点）：
  - 简单类型（`Copy`：`i32` 等）字段的赋值/修改
  - 引用类型 / 堆类型（`String`、`Vec`）的移动、借用修改、`clone`
  - 通过 `&mut self` / `&mut T` 修改字段与子元素
  - 从集合删除元素时所有权归还（`remove` 返回值）
- 每个操作配「错误示范 → 正确写法」对照代码

### 03 — 指针与智能指针

文件：[blog/rust-lang/03-pointers.md](blog/rust-lang/03-pointers.md)

全面覆盖 Rust「指针族」，避免与 C 裸指针混为一谈：

| 类别 | 内容 |
|------|------|
| 借用 | `&T`、`&mut T`、再借用、可变性规则 |
| 胖指针 | 切片 `&[T]`、`&str`、trait object `&dyn Trait` 的双字布局直觉 |
| 独占堆 | `Box<T>`：递归类型、堆分配、解引用 |
| 共享所有权 | `Rc` / `Weak`；多线程 `Arc` |
| 内部可变性 | `Cell`、`RefCell`、`Mutex`/`RwLock`（与第 6 章交叉引用） |
| 原生指针 | `*const T` / `*mut T`：何时出现、基本用法，点到为止不写 exploit |

每类：创建 → 解引用/方法 → 修改/共享场景 → 常见 panic 或编译错误。

### 04 — Trait：分类与内存布局

文件：[blog/rust-lang/04-traits.md](blog/rust-lang/04-traits.md)

- Trait 定义、`impl Trait for T`、默认方法、`where`、关联类型 vs 泛型参数
- **标准 Trait 分类讲解**（每类配实现/使用示例）：
  - 标记：`Copy`、`Send`、`Sync`、`Sized`
  - 转换：`From`/`Into`、`TryFrom`/`TryInto`、`AsRef`/`AsMut`
  - 运算与比较：`Add` 等、`PartialEq`/`Eq`、`PartialOrd`/`Ord`、`Hash`
  - 常用派生与手写：`Clone`、`Debug`、`Default`
  - 迭代：`Iterator`、`IntoIterator`、`FromIterator`
  - 析构：`Drop`
  - 闭包相关：`Fn`/`FnMut`/`FnOnce`（为异步章铺垫）
- **内存布局**（中高级核心）：
  - 单态化（static dispatch）vs `dyn Trait`（dynamic dispatch）
  - vtable：胖指针 = data ptr + vtable ptr；示意图（mermaid）
  - `impl Trait`（参数/返回值）与 `dyn Trait` 的选择
  - object safety 直觉说明
- 不展开：特化、GAT 深水区（可一句「存在」）

### 05 — Option、Result 与特有语法

文件：[blog/rust-lang/05-option-result.md](blog/rust-lang/05-option-result.md)

- `Option<T>` / `Result<T, E>` 语义与何时用哪个
- 组合子：`map`/`and_then`/`or_else`/`unwrap_or`/`unwrap_or_else`/`ok_or` 等（表格 + 链式示例）
- **特有语法**：
  - `?` 运算符与 `From` 错误转换
  - `if let` / `while let` / `let-else`
  - `match` 守卫、`@` 绑定、嵌套解构
  - `matches!`、`Option` 上的 `?`（在返回 `Option` 的函数中）
- 自定义错误：`thiserror` 式手写 `enum` + `impl From`（不强制引入 crate，可纯标准库示例）
- 与早期「到处 unwrap」对比的工程化写法

### 06 — 异步与多线程

文件：[blog/rust-lang/06-async-threads.md](blog/rust-lang/06-async-threads.md)

**多线程**

- `std::thread::spawn`、`JoinHandle`、`move` 闭包
- 消息传递：`mpsc`（或 `std::sync::mpsc`）
- 共享状态：`Arc<Mutex<T>>`、`RwLock`；死锁直觉
- `scoped threads`（若 edition/版本允许）简述

**异步**

- `async`/`await` 语法、Future 状态机直觉（不写完整编译器细节）
- 运行时：以 **Tokio** 为例（文内 `Cargo.toml` 片段 + `#[tokio::main]`）
- `tokio::spawn`、`JoinHandle`、取消与 `'static` 约束
- `select!`、超时、`join!`
- `Stream` 概念点到为止
- **async 与多线程交界**：`SpawnBlocking`、为何不能在 async 里阻塞；`Send` bound

**特殊语法汇总表**：`async fn`、`.await`、`Pin` 仅作「为何接口长这样」的极简说明（避免整章 Pin 专论）。

---

## 写作约定

- 每章结构固定：导读 → 概念 → 详尽示例 → 易错点 → 与前后章链接
- 代码块标注语言 `rust` / `toml`；关键片段尽量完整到「可粘贴进 `fn main`」
- 用表格对比「简单类型 vs 引用/堆类型」「`&T` vs `Box` vs `Rc`」等
- 中文术语统一：Trait、所有权、借用、胖指针、单态化、动态分发

## 明确不做

- 独立 `rust-lang-demo/` 工程
- 基础语法入门、宏、完整 unsafe、FFI、测试/bench、Web/Wasm（仓库其它文已覆盖）
- 一次性超长单文件（可读性差；若你更偏好单文件可改为合并，默认多章）
