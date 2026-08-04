---
title: "05 · Option、Result 与特有语法"
date: 2026-08-04
tags: [rust, option, result, error-handling]
description: "Option/Result 语义与组合子，以及 ?、if let、let-else、match 等 Rust 特有语法与自定义错误。"
---

# 05 · Option、Result 与特有语法

> 上一篇：[Trait 分类与内存布局](./04-traits.md) · 下一篇：[异步与多线程](./06-async-threads.md)

`Option` 与 `Result` 是 Rust 把「可能没有」和「可能失败」编码进类型系统的方式。本章覆盖语义、组合子，以及围绕它们的特有语法；并给出不依赖第三方宏的自定义错误写法。

---

## 1. 语义：何时用哪个

```rust
enum Option<T> {
    None,
    Some(T),
}

enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

| 类型 | 含义 | 典型场景 |
| --- | --- | --- |
| `Option<T>` | 有值或没有 | 查找、可空字段、合法的「缺席」 |
| `Result<T, E>` | 成功或失败 | IO、解析、任何可恢复错误 |

```rust
fn find_user(id: u64) -> Option<String> {
    if id == 1 {
        Some("ada".into())
    } else {
        None
    }
}

fn parse_port(s: &str) -> Result<u16, std::num::ParseIntError> {
    s.parse()
}
```

把错误做成 `Option`（失败也当 `None`）会丢掉原因；把「合法缺席」做成 `Result` 会逼调用方处理根本不是错误的情况。

---

## 2. 组合子速查

### 2.1 常用表

| 方法 | `Option` | `Result` | 作用 |
| --- | --- | --- | --- |
| `map` | `Some` 内映射 | `Ok` 内映射 | 变换成功值 |
| `map_err` | — | 变换错误 | 换错误类型 |
| `and_then` | 链式再返回 Option/Result | 同左 | 扁平化嵌套 |
| `or` / `or_else` | 缺席时后备 | 失败时后备 | 提供替代 |
| `unwrap_or` | 默认值 | 默认值 | 立即给后备 |
| `unwrap_or_else` | 懒默认 | 懒默认 | 闭包产生后备 |
| `unwrap_or_default` | 要 `T: Default` | 同左 | |
| `ok_or` / `ok_or_else` | → `Result` | — | 缺席变错误 |
| `ok` / `err` | — | → `Option` | 拆一侧 |
| `transpose` | `Option<Result>` ↔ `Result<Option>` | | 调换嵌套 |

### 2.2 链式示例

```rust
fn pipeline(input: &str) -> Result<u32, String> {
    input
        .lines()
        .next()
        .ok_or_else(|| "empty input".to_string())
        .and_then(|line| {
            line.trim()
                .parse::<u32>()
                .map_err(|e| format!("parse: {e}"))
        })
        .map(|n| n * 2)
}

fn option_chain(map: &std::collections::HashMap<String, String>, key: &str) -> Option<usize> {
    map.get(key).map(|s| s.len()).filter(|&len| len > 0)
}
```

### 2.3 `unwrap` 家族（谨慎）

```rust
fn unwrap_family() {
    let x = Some(1);
    assert_eq!(x.unwrap(), 1); // None 则 panic
    assert_eq!(x.expect("must exist"), 1); // panic 带信息

    let r: Result<i32, &str> = Ok(1);
    assert_eq!(r.unwrap(), 1);
}
```

库代码与生产路径优先 `?` / 组合子；`unwrap`/`expect` 留给断言「逻辑上必有」或快速脚本。

---

## 3. 特有语法

### 3.1 `?` 运算符

在返回 `Result`（或 `Option`）的函数里，`?` 表示：若是 `Err`/`None` 则 **提前返回**；若是 `Ok`/`Some` 则解包继续。

```rust
use std::fs::File;
use std::io::{self, Read};

fn read_file(path: &str) -> io::Result<String> {
    let mut f = File::open(path)?; // Err → return Err
    let mut s = String::new();
    f.read_to_string(&mut s)?;
    Ok(s)
}

fn first_line(path: &str) -> io::Result<String> {
    let content = read_file(path)?;
    content
        .lines()
        .next()
        .map(|s| s.to_string())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "empty"))
}
```

`Option` 上也能用 `?`：

```rust
fn sum_first_two(v: &[i32]) -> Option<i32> {
    let a = *v.get(0)?;
    let b = *v.get(1)?;
    Some(a + b)
}
```

错误类型不同时，`?` 会调用 `From`：

```rust
#[derive(Debug)]
enum AppError {
    Io(std::io::Error),
    Parse(std::num::ParseIntError),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e)
    }
}

impl From<std::num::ParseIntError> for AppError {
    fn from(e: std::num::ParseIntError) -> Self {
        Self::Parse(e)
    }
}

fn load_count(path: &str) -> Result<i32, AppError> {
    let mut s = String::new();
    File::open(path)?.read_to_string(&mut s)?; // io::Error → AppError
    let n: i32 = s.trim().parse()?; // ParseIntError → AppError
    Ok(n)
}
```

### 3.2 `if let` / `while let`

```rust
fn if_let_demo(x: Option<i32>) {
    if let Some(v) = x {
        println!("got {v}");
    } else {
        println!("nothing");
    }
}

fn while_let_demo() {
    let mut stack = vec![1, 2, 3];
    while let Some(top) = stack.pop() {
        println!("{top}");
    }
}
```

### 3.3 `let-else`（Rust 1.65+）

绑定失败则走发散分支（`return` / `break` / `panic!` 等）：

```rust
fn let_else(map: &std::collections::HashMap<&str, i32>, key: &str) -> i32 {
    let Some(&v) = map.get(key) else {
        return -1;
    };
    v * 2
}
```

比嵌套 `if let` 更扁平，适合「守卫式」提前退出。

### 3.4 `match`：守卫、`@`、嵌套解构

```rust
enum Msg {
    Ping,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(u8, u8, u8),
}

fn match_power(msg: Msg) {
    match msg {
        Msg::Ping => println!("pong"),
        Msg::Move { x, y: 0 } => println!("horizontal {x}"),
        Msg::Move { x, y } if x == y => println!("diagonal"),
        Msg::Move { x, y } => println!("move {x},{y}"),
        Msg::Write(s) if s.len() > 10 => println!("long write"),
        Msg::Write(ref s) => println!("write {s}"),
        Msg::ChangeColor(r, g, b) => println!("rgb({r},{g},{b})"),
    }
}

fn at_binding(x: Option<i32>) {
    match x {
        Some(n @ 1..=10) => println!("small {n}"),
        Some(n @ 11..=100) => println!("mid {n}"),
        Some(n) => println!("other {n}"),
        None => {}
    }
}
```

### 3.5 `matches!` 宏

只关心「是否匹配」、不要绑定：

```rust
fn is_none_or_zero(x: Option<i32>) -> bool {
    matches!(x, None | Some(0))
}
```

### 3.6 解构进函数参数 / 结构体更新旁路

```rust
struct Point {
    x: i32,
    y: i32,
}

fn manhattan(Point { x, y }: Point) -> i32 {
    x.abs() + y.abs()
}

fn split_option() {
    let pair = Some((1, "a"));
    if let Some((n, s)) = pair {
        println!("{n}, {s}");
    }
}
```

---

## 4. 自定义错误（纯标准库）

不必上 `thiserror` / `anyhow` 也能写出清晰错误类型；第三方宏只是少写样板。

```rust
use std::fmt;

#[derive(Debug)]
enum ServiceError {
    NotFound(String),
    Unauthorized,
    Msg(String),
}

impl fmt::Display for ServiceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(id) => write!(f, "not found: {id}"),
            Self::Unauthorized => write!(f, "unauthorized"),
            Self::Msg(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for ServiceError {}

fn fetch_user(id: &str) -> Result<String, ServiceError> {
    if id.is_empty() {
        return Err(ServiceError::Msg("empty id".into()));
    }
    if id == "0" {
        return Err(ServiceError::Unauthorized);
    }
    if id == "404" {
        return Err(ServiceError::NotFound(id.into()));
    }
    Ok(format!("user-{id}"))
}

fn handler(id: &str) -> Result<(), ServiceError> {
    let name = fetch_user(id)?;
    println!("hello {name}");
    Ok(())
}
```

若要自动从 `io::Error` 转来，再补 `impl From<io::Error> for ServiceError`（同第 3.1 节）。

应用层想「随便装一种错误、保留上下文」时，可用 `Box<dyn std::error::Error + Send + Sync>` 或生态里的 `anyhow::Error`；库 API 更宜暴露具体错误枚举。

---

## 5. 工程化对照：少用 `unwrap`

**早期草稿：**

```rust
fn draft(path: &str) -> usize {
    let s = std::fs::read_to_string(path).unwrap();
    s.lines().next().unwrap().parse().unwrap()
}
```

**收敛后：**

```rust
fn solid(path: &str) -> Result<usize, Box<dyn std::error::Error>> {
    let s = std::fs::read_to_string(path)?;
    let line = s.lines().next().ok_or("empty file")?;
    Ok(line.parse()?)
}
```

或返回你的 `AppError`，让 `main` 统一打印：

```rust
fn main() {
    if let Err(e) = solid("n.txt") {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}
```

---

## 6. `Option` / `Result` 与集合、指针的交界

```rust
use std::collections::HashMap;

fn entry_style(map: &mut HashMap<String, Vec<i32>>, key: &str, val: i32) {
    map.entry(key.to_string()).or_default().push(val);
}

fn remove_take(map: &mut HashMap<String, String>, key: &str) -> Option<String> {
    map.remove(key) // 直接是 Option
}
```

智能指针上常见：

```rust
use std::rc::Rc;

fn upgrade(weak: &std::rc::Weak<String>) -> Option<Rc<String>> {
    weak.upgrade() // 失败 → None，不是 Result
}
```

---

## 7. 易错点

1. **`?` 用在返回 `()` 或其它类型的函数**——改返回类型，或在闭包/`main` 里 `match`。
2. **嵌套 `Result<Option<_>>` 忘了 `transpose`**——类型别扭、`?` 不好使。
3. **`if let` 丢掉 `else` 里的错误信息**——该用 `match` / `let-else` 时别省。
4. **对 `Option` 链式 `unwrap` 伪装成安全**——中间任何一步都可能 panic。
5. **库对外公开 `Box<dyn Error>` 却无法 `match` 具体变体**——考虑类型化错误枚举。

---

## 8. 小结与下一章

`Option`/`Result` 把控制流写成类型流：`?` 负责传播，组合子负责变换，模式匹配负责分支。下一章 [异步与多线程](./06-async-threads.md) 会在线程与 `async` 里继续看到 `Result`、以及 `JoinHandle` 上的错误传递。
