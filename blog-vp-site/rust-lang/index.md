---
title: "Rust 中高级学习教程"
date: 2026-08-04
tags: [rust, ownership, trait, async, cargo]
description: "面向已掌握基础语法的开发者：模块与 Cargo、集合与结构体、智能指针、Trait 与内存布局、Option/Result、异步与多线程。"
---

# Rust 中高级学习教程

本系列默认你已经会写变量、函数、基础所有权与生命周期直觉，能独立跑通 `cargo new` / `cargo run`。目标不是再讲一遍 Hello World，而是把日常工程里最常卡住的六块能力串成一条可查阅的知识链。

**无独立 demo 工程**。各章以文内可粘贴的完整示例为主；异步章会注明 `tokio` 等依赖写法。

## 读者画像

- 写过一些 Rust，但模块拆分、`Cargo.toml` features、workspace 仍凭感觉
- 改 `Vec` / `HashMap` / 结构体字段时经常撞上借用检查器
- 对 `Box` / `Rc` / `Arc` / `RefCell` 知道名字，不清楚何时用哪种
- 会 `impl Trait`，但不清楚 `dyn Trait` 的胖指针与 vtable
- 知道 `Option` / `Result`，但 `?`、`let-else`、错误链还写不顺
- 需要在线程与 `async` 之间选型，或两者混用

## 建议阅读顺序

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

1. **01 模块与 Cargo** — 工程骨架先立住，后面示例才有落点
2. **02 集合与结构体** — 所有权在「容器 + 字段」上的真实打法
3. **03 指针** — 从借用到智能指针，为 Trait object 与并发铺路
4. **04 Trait** — 标准 Trait 分类 + 单态化 / dyn 布局
5. **05 Option / Result** — Rust 特有错误与可选值语法
6. **06 异步与多线程** — `thread` / `async` 语法与交界地带

## 章节索引

| # | 文章 | 内容要点 |
| --- | --- | --- |
| 01 | [模块、包管理与 Cargo.toml](./01-modules-cargo.md) | Package / Crate / Module、可见性、常用 TOML 配置 |
| 02 | [常用数据结构与结构体](./02-collections-structs.md) | Vec、HashMap、结构体；简单类型 vs 引用类型的增删改 |
| 03 | [引用与智能指针](./03-pointers.md) | `&T` / `Box` / `Rc` / `Arc` / `Cell` / `RefCell` / 裸指针 |
| 04 | [Trait 分类与内存布局](./04-traits.md) | 标准 Trait 分组、vtable、`impl Trait` vs `dyn Trait` |
| 05 | [Option、Result 与特有语法](./05-option-result.md) | 组合子、`?`、`if let` / `let-else`、自定义错误 |
| 06 | [异步与多线程](./06-async-threads.md) | `thread`、mpsc、`Arc<Mutex>`、Tokio、`select!` / `join!` |

## 本系列不覆盖

以下主题有意排除，避免摊成「第二本 The Book」：

- 安装、环境、基础语法入门
- 宏（`macro_rules!` / proc-macro）专论
- 完整 `unsafe`、FFI、自定义分配器
- 测试 / bench / Criterion 体系
- Web / Wasm / WASI（见仓库其它系列）
- 生命周期专题独立长文（只在指针、结构体章按需穿插）

## 术语约定

| 中文 | 英文 / 符号 |
| --- | --- |
| 所有权 | ownership |
| 借用 | borrow / `&T` / `&mut T` |
| 胖指针 | fat pointer |
| 单态化 | monomorphization |
| 动态分发 | dynamic dispatch / `dyn Trait` |
| Trait | trait（文中不写成「接口」以免与 OOP 混淆） |
