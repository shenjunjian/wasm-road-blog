---
title: "06 · 异步与多线程"
date: 2026-08-04
tags: [rust, async, tokio, thread, concurrency]
description: "标准库多线程、mpsc 与 Arc Mutex；async/await 与 Tokio 特殊语法；以及异步与阻塞交界的注意点。"
---

# 06 · 异步与多线程

> 上一篇：[Option 与 Result](./05-option-result.md) · 返回：[系列导读](./)

并发在 Rust 里主要两条路：**OS 线程**（`std::thread`）与 **异步任务**（`async`/`await` + 运行时）。本章先讲线程与共享状态，再讲 Future / Tokio 语法，最后交代两者交界处最容易踩的坑。

---

## 1. 何时选线程、何时选异步

| 场景 | 更合适 |
| --- | --- |
| CPU 密集、要吃满多核 | 线程池 / `rayon` 一类；或 `spawn_blocking` |
| 大量 IO 等待（网络、磁盘） | `async` + 非阻塞 IO |
| 简单后台活、与现有同步代码集成 | `std::thread` |
| 高并发连接、每个连接状态机 | `async` |

异步 **不会**魔法加速单段 CPU 计算；它提高的是「等」的效率。

---

## 2. 多线程：`std::thread`

### 2.1 `spawn` 与 `JoinHandle`

```rust
use std::thread;
use std::time::Duration;

fn spawn_basic() {
    let handle = thread::spawn(|| {
        for i in 0..3 {
            println!("child {i}");
            thread::sleep(Duration::from_millis(10));
        }
        42 // 返回值类型 T，join 后得到 Result<T>
    });

    for i in 0..2 {
        println!("main {i}");
        thread::sleep(Duration::from_millis(10));
    }

    let v = handle.join().expect("child panicked");
    println!("child returned {v}");
}
```

`join` 的 `Err` 表示子线程 **panic**；payload 是 `Box<dyn Any + Send>`。

### 2.2 `move` 闭包与所有权

```rust
fn move_closure() {
    let name = String::from("worker");
    let handle = thread::spawn(move || {
        // name 的所有权移入线程；主线程不能再使用 name
        println!("hello {name}");
    });
    handle.join().unwrap();
}
```

多线程共享同一份数据：用 `Arc`（见 [03](./03-pointers.md)）。

### 2.3 Scoped threads（作用域线程）

`std::thread::scope`（1.63+）允许子线程借用父栈上的非 `'static` 数据：作用域结束前必须全部 join。

```rust
use std::thread;

fn scoped() {
    let mut data = vec![1, 2, 3];

    thread::scope(|s| {
        s.spawn(|| {
            println!("len={}", data.len());
        });
        s.spawn(|| {
            println!("first={}", data[0]);
        });
    }); // 此处保证子线程已结束

    data.push(4);
}
```

---

## 3. 消息传递：`mpsc`

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn channels() {
    let (tx, rx) = mpsc::channel::<String>();
    let tx2 = tx.clone();

    thread::spawn(move || {
        tx.send("from-1".into()).unwrap();
    });
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(5));
        tx2.send("from-2".into()).unwrap();
    });

    for msg in rx.iter().take(2) {
        println!("got {msg}");
    }
}
```

| API | 含义 |
| --- | --- |
| `channel` | 异步无限缓冲（逻辑上） |
| `sync_channel(n)` | 有界；满时发送方可阻塞 |
| `send` | 失败表示接收端已全部 drop |
| `recv` / `try_recv` / `recv_timeout` | 阻塞 / 非阻塞 / 超时 |

多生产者：`Sender` 可 `clone`；`Receiver` 通常一个。

---

## 4. 共享状态：`Arc<Mutex<T>>` / `RwLock`

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn shared_counter() {
    let counter = Arc::new(Mutex::new(0u64));
    let mut handles = vec![];

    for _ in 0..10 {
        let c = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            let mut g = c.lock().unwrap();
            *g += 1;
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
    assert_eq!(*counter.lock().unwrap(), 10);
}
```

### 4.1 死锁直觉

```rust
use std::sync::{Arc, Mutex};

fn deadlock_risk(a: Arc<Mutex<i32>>, b: Arc<Mutex<i32>>) {
    // 线程1: lock a → lock b
    // 线程2: lock b → lock a
    // 可能互相等待
    let _ = (a, b);
}
```

实践建议：统一加锁顺序；缩小临界区；避免在持锁时再调会加同一把锁的代码；复杂图用消息传递代替多锁。

`lock().unwrap()` 在另一持锁线程 **panic** 时会变成 poisoned；可用 `lock().unwrap_or_else(|e| e.into_inner())` 恢复，或按业务决定崩溃。

---

## 5. 异步：`async` / `await` 与 Future

### 5.1 语法直觉

`async fn` 并不立即执行函数体，而是返回一个实现了 `Future` 的状态机；只有被 **轮询**（通常通过运行时 `.await`）才会推进。

```rust
async fn add(a: i32, b: i32) -> i32 {
    a + b
}

async fn compute() -> i32 {
    let x = add(1, 2).await; // 等待该 Future 完成
    let y = add(x, 3).await;
    y
}
```

等价于「返回 `impl Future<Output = i32>`」。

状态机直觉（不必手写）：每个 `.await` 点可能挂起；本地变量被编译器搬进状态机字段，因此跨 `.await` 持有的类型常需 `Send`（多线程运行时）。

### 5.2 为何需要运行时

标准库提供 `Future` trait，但 **没有** 内置执行器去 `poll` 成千上万个任务。常用 Tokio、async-std、smol 等。下文以 **Tokio** 为例。

### 5.3 Cargo 依赖

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
# 更精简时按需：
# tokio = { version = "1", features = ["rt-multi-thread", "macros", "time", "sync", "net"] }
```

### 5.4 `#[tokio::main]` 与手动 Runtime

```rust
#[tokio::main]
async fn main() {
    let v = compute().await;
    println!("{v}");
}

// 或
fn main_manual() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        println!("{}", compute().await);
    });
}
```

`#[tokio::main(flavor = "current_thread")]` 用单线程调度器，适合轻量或嵌入。

---

## 6. Tokio 任务与组合

### 6.1 `tokio::spawn`

```rust
#[tokio::main]
async fn spawn_demo() {
    let handle = tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        "done"
    });

    // JoinHandle：await 得到 Result<T, JoinError>
    match handle.await {
        Ok(v) => println!("{v}"),
        Err(e) => eprintln!("task panic: {e}"),
    }
}
```

约束（多线程 runtime）：

- 任务常要求 `Future + Send + 'static`
- 因此闭包/`async` 块捕获的数据要能转到其它线程，且不能借短生命周期栈引用（应 `Arc` 或拥有型）

```rust
async fn spawn_arc() {
    use std::sync::Arc;
    let data = Arc::new(vec![1, 2, 3]);
    let d = Arc::clone(&data);
    tokio::spawn(async move {
        println!("len={}", d.len());
    })
    .await
    .unwrap();
}
```

### 6.2 `join!`：并发等多个

```rust
async fn parallel_sum() -> i32 {
    let (a, b) = tokio::join!(async { 1 }, async { 2 });
    a + b
}
```

`join!` 同时驱动多个 Future，全部完成才继续；某一个 panic / 失败策略取决于你如何写内部逻辑。

### 6.3 `select!`：谁先完成听谁

```rust
use tokio::sync::oneshot;

#[tokio::main]
async fn select_demo() {
    let (tx, rx) = oneshot::channel::<&'static str>();

    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        let _ = tx.send("slow");
    });

    tokio::select! {
        _ = tokio::time::sleep(std::time::Duration::from_millis(5)) => {
            println!("timeout wins");
        }
        msg = rx => {
            println!("got {:?}", msg);
        }
    }
}
```

`select!` 取消未完成的分支时，对应 Future 被 drop——若内部有 RAII 资源，析构会跑；需注意「取消安全」（持锁跨 await 等）。

### 6.4 超时

```rust
async fn with_timeout() {
    let result = tokio::time::timeout(
        std::time::Duration::from_millis(10),
        async {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            1
        },
    )
    .await;

    match result {
        Ok(v) => println!("ok {v}"),
        Err(_) => println!("timed out"),
    }
}
```

---

## 7. 异步与多线程的交界

### 7.1 不要在 async 里做阻塞调用

```rust
async fn bad() {
    // std::thread::sleep 或 std::fs::read 会卡住整个 worker 线程
    // std::thread::sleep(std::time::Duration::from_secs(1));
}

async fn good() {
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    // 文件 IO 用 tokio::fs；或下面 spawn_blocking
}
```

### 7.2 `spawn_blocking`

把阻塞 / CPU 重活丢到专用阻塞线程池：

```rust
async fn read_sync_style(path: String) -> std::io::Result<String> {
    tokio::task::spawn_blocking(move || std::fs::read_to_string(path))
        .await
        .expect("blocking task panicked")
}
```

### 7.3 锁与 `.await`

**`std::sync::Mutex` 的 Guard 不应跨 `.await` 持有**：挂起时仍占着锁，其它任务/线程易死锁，且 Guard 通常不是 `Send`。

做法：

1. 缩小临界区：算完立刻 drop guard，再 `.await`
2. 或使用 `tokio::sync::Mutex`（可跨 await，但持锁期间不要跑长时间 CPU）

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

async fn tokio_mutex() {
    let data = Arc::new(Mutex::new(0));
    let d = Arc::clone(&data);
    tokio::spawn(async move {
        let mut g = d.lock().await;
        *g += 1;
        // 如需 await，确保理解锁会一直持有到 g drop
    })
    .await
    .unwrap();
}
```

### 7.4 `Send` bound 报错怎么读

常见编译错误：`future cannot be sent between threads safely`。

原因往往是：跨 `.await` 还活着 `Rc`、`RefCell`、裸指针、或某些 Guard。改成 `Arc`、缩短借用、或改用 `current_thread` runtime（若适用）。

---

## 8. Stream（点到为止）

异步版「迭代器」是 `Stream`（Tokio / `futures` crate）。例如按行读网络帧、无限事件源。

```rust
// 示意：需 futures / tokio-stream 等
// use tokio_stream::StreamExt;
// while let Some(item) = stream.next().await { ... }
```

掌握 `Future` + `select!` / `join!` 后，再按需查阅 `StreamExt` 即可。

---

## 9. 特殊语法与概念汇总

| 语法 / 概念 | 含义 |
| --- | --- |
| `async fn` / `async { }` | 生成 Future 状态机 |
| `.await` | 在异步上下文中轮询直到完成 |
| `#[tokio::main]` | 生成 runtime 并 `block_on` |
| `tokio::spawn` | 调度独立任务，返回 `JoinHandle` |
| `join!` | 同时等待多个 Future |
| `select!` | 竞速多个分支 |
| `Pin` | 保证 Future 自引用状态机不被随意移动；多数用户只在签名里见到 `Pin<&mut Self>`，不必手写 Pin 专论 |
| `Send` + `'static` | 多线程任务的常见门槛 |

关于 `Pin`：编译器生成的 `async` 状态机可能在内部借用自己的字段；若 Future 在内存中被移动，这些自引用会失效。`Pin` API 把「不能随便移」写进类型。日常写业务异步函数时，交给 `.await` 与运行时即可。

---

## 10. 综合示例：线程产数据，异步消费（概念拼装）

下面展示边界，而不是推荐复杂架构；真实项目更常「全程 async」或「全程线程」。

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[tokio::main]
async fn bridge_demo() {
    let (tx, rx) = mpsc::channel::<i32>();

    thread::spawn(move || {
        for i in 0..5 {
            tx.send(i).unwrap();
            thread::sleep(Duration::from_millis(5));
        }
    });

    // 阻塞 recv 放到 spawn_blocking，避免卡住 runtime
    let handle = tokio::task::spawn_blocking(move || {
        let mut sum = 0;
        for _ in 0..5 {
            sum += rx.recv().unwrap();
        }
        sum
    });

    let sum = handle.await.unwrap();
    println!("sum={sum}");
}
```

---

## 11. 易错点

1. **在 `async fn` 里 `std::thread::sleep` / 同步 `Mutex` 长临界区**——饿死调度器。
2. **以为 `tokio::spawn` 立刻并行跑完**——只是调度；要结果就 `.await` handle。
3. **在 spawn 的 async 块里借用局部变量**——改 `Arc` 或 `move` 拥有型数据。
4. **`select!` 取消导致半完成副作用**——设计幂等或显式取消令牌（`CancellationToken`）。
5. **线程 + async 双体系无边界地混锁**——统一模型，或用通道做边界。

---

## 12. 小结

- **线程**：`spawn` / `scope`、`mpsc`、`Arc<Mutex<_>>` 解决共享与通信。
- **异步**：`async`/`await` 定义状态机；Tokio 负责调度；`join!`/`select!`/`timeout` 组合并发。
- **交界**：阻塞逻辑进 `spawn_blocking`；锁不要随便跨 `.await`。

至此本系列六章结束。可从 [导读](./) 回看索引，或按需跳回 [模块与 Cargo](./01-modules-cargo.md)、[集合](./02-collections-structs.md)、[指针](./03-pointers.md)、[Trait](./04-traits.md)、[Option/Result](./05-option-result.md) 查阅。
