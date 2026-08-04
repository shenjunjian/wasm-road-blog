---
title: "02 · 常用数据结构与结构体"
date: 2026-08-04
tags: [rust, vec, hashmap, struct, ownership]
description: "Vec、HashMap、结构体的增删改用法，并对照简单类型与引用/堆类型在所有权下的差异。"
---

# 02 · 常用数据结构与结构体

> 上一篇：[模块与 Cargo](./01-modules-cargo.md) · 下一篇：[引用与智能指针](./03-pointers.md)

集合与结构体是日常改数据的主战场。本章不只列 API，更强调：**元素/字段是 `Copy` 简单类型，还是 `String` / `Vec` 这类移动语义类型**，增删改时写法完全不同。

---

## 1. 先分清两类值

| 类别 | 典型类型 | 赋值 / 传参 | 修改字段或元素 |
| --- | --- | --- | --- |
| 简单类型（通常 `Copy`） | `i32`、`bool`、`f64`、`char`、小数组等 | 按位复制，原变量仍可用 | 直接 `x =` 或 `*p =` |
| 堆 / 移动类型 | `String`、`Vec<T>`、`HashMap`、多数结构体 | 移动（move），原变量失效 | 需要 `&mut`，或取出所有权再放回 |

```rust
fn demo_copy_vs_move() {
    let a = 10;
    let b = a; // Copy
    println!("{a}, {b}");

    let s = String::from("hi");
    let t = s; // Move：此后不能再用 s
    // println!("{s}"); // error[E0382]
    println!("{t}");
}
```

下文示例里会反复用到这个对照。

---

## 2. `Vec<T>`

### 2.1 创建与读写

```rust
fn vec_basics() {
    let mut v: Vec<i32> = Vec::new();
    v.push(1);
    v.push(2);

    let mut w = vec![10, 20, 30]; // 宏：带初始元素
    w[1] = 21;                    // 索引要求：Copy 或替换整个元素

    let first = w[0];             // i32: Copy
    let first_ref = &w[0];        // 借用，不移动
    println!("{first}, {first_ref}");

    // 安全索引
    match w.get(99) {
        Some(x) => println!("{x}"),
        None => println!("out of range"),
    }
}
```

堆类型元素不能「按索引 Copy 出来」：

```rust
fn vec_string_index() {
    let mut names = vec![String::from("ada"), String::from("bob")];

    // let n = names[0]; // error：不能移动出索引
    let n_ref: &String = &names[0];
    let n_clone = names[0].clone();

    // 修改元素内容（不替换整个 String）
    names[0].push_str(" lovelace");

    // 替换整个元素：旧值被 drop，或被返回
    let old = std::mem::replace(&mut names[1], String::from("carol"));
    println!("{n_ref}, {n_clone}, old={old}");
}
```

### 2.2 增删：`push` / `pop` / `insert` / `remove` / `swap_remove`

```rust
fn vec_mutate() {
    let mut v = vec![1, 2, 3, 4];

    v.push(5);                 // 尾部追加
    let last = v.pop();        // Some(5)，所有权交给你
    v.insert(1, 9);            // 在下标 1 插入，后面元素后移 O(n)
    let removed = v.remove(2); // 删除下标 2，后面前移 O(n)，返回被删元素
    let swapped = v.swap_remove(0); // 与末尾交换再删，O(1)，打乱顺序

    println!("{last:?}, {removed}, {swapped}, {v:?}");
}
```

对 `Vec<String>`，`remove` / `pop` 会 **归还所有权**，很适合「取出后处理」：

```rust
fn take_from_vec() {
    let mut tasks = vec![String::from("a"), String::from("b"), String::from("c")];
    let second = tasks.remove(1); // 现在你拥有 "b"
    println!("took {second}, left {tasks:?}");
}
```

### 2.3 迭代时修改的陷阱

**错误**：一边 `iter()` / `for x in &v`，一边 `push` / `remove`——借用检查器会拒绝；即便强行用索引循环删元素，也容易下标错乱。

```rust
fn bad_iter_mutate() {
    let mut v = vec![1, 2, 3];
    // for x in &v {
    //     v.push(*x); // error[E0502]：不可变借用期间可变借用
    // }
    let _ = v;
}
```

**正确思路**（按场景选）：

```rust
fn good_patterns() {
    let mut v = vec![1, 2, 3, 4, 5];

    // 1) 先收集要改的信息，再改
    let to_double: Vec<_> = v.iter().copied().filter(|x| x % 2 == 0).collect();
    for x in to_double {
        v.push(x);
    }

    // 2) 就地保留/删除：retain
    v.retain(|x| *x < 10);

    // 3) 抽出一段所有权：drain（留下空洞被填上）
    let mut mid = vec![10, 20, 30, 40];
    let drained: Vec<_> = mid.drain(1..3).collect(); // 拿走 20,30
    println!("drained={drained:?}, mid={mid:?}");

    // 4) 可变迭代改「元素内部」，不增删长度
    let mut words = vec![String::from("a"), String::from("b")];
    for w in &mut words {
        w.push('!');
    }
}
```

### 2.4 切片 `&[T]` / `&mut [T]`

```rust
fn slices() {
    let mut v = vec![1, 2, 3, 4, 5];
    let all: &[i32] = &v[..];
    let mid: &mut [i32] = &mut v[1..4];
    mid[0] = 99; // 改的是原 Vec 的窗口
    println!("{all:?}"); // 注意：此时若仍持有 all 会与 mid 冲突；示例请分作用域
}
```

更稳妥的写法：

```rust
fn slices_scoped() {
    let mut v = vec![1, 2, 3, 4, 5];
    {
        let mid = &mut v[1..4];
        mid[0] = 99;
    }
    println!("{:?}", &v[..]); // [1, 99, 3, 4, 5]
}
```

---

## 3. `HashMap<K, V>` / `HashSet<T>`

`K` 必须实现 `Eq + Hash`。常用 key：`String`、`i32`、`&str`（作 key 时注意生命周期；拥有型更省心用 `String`）。

### 3.1 插入、读取、更新

```rust
use std::collections::HashMap;

fn map_basics() {
    let mut scores: HashMap<String, i32> = HashMap::new();
    scores.insert(String::from("red"), 10);
    scores.insert(String::from("blue"), 20);

    // 读取：Copy 值可以直接解出来
    let red = scores.get("red").copied().unwrap_or(0);

    // 覆盖插入：返回旧值 Option<V>
    let old = scores.insert(String::from("red"), 15); // Some(10)

    // entry API：只在缺失时插入
    scores.entry(String::from("green")).or_insert(1);
    // 存在则改
    let e = scores.entry(String::from("green")).or_insert(0);
    *e += 1;

    println!("red={red}, old={old:?}, map={scores:?}");
}
```

值是 `String` 时，`get` 得到 `&String`；要拿走所有权用 `remove`：

```rust
fn map_string_values() {
    let mut m: HashMap<String, String> = HashMap::new();
    m.insert("k".into(), "v".into());

    // let v = m["k"]; // error：不能把非 Copy 值移出索引
    let v_ref = m.get("k").map(|s| s.as_str());
    if let Some(owned) = m.remove("k") {
        println!("took {owned}, was_ref={v_ref:?}");
    }
}
```

### 3.2 删除与遍历

```rust
fn map_remove_iter() {
    let mut m = HashMap::from([
        ("a".to_string(), 1),
        ("b".to_string(), 2),
        ("c".to_string(), 3),
    ]);

    m.remove("b");
    m.retain(|_k, v| *v >= 2);

    for (k, v) in &m {
        println!("{k} => {v}");
    }
    for (k, v) in &mut m {
        *v += 10; // 改值：V 为 Copy 或通过 &mut V 改内部
    }
    for (k, v) in m {
        // 消费整个 map，拿走所有权
        println!("owned {k} => {v}");
    }
}
```

### 3.3 `HashSet`

```rust
use std::collections::HashSet;

fn set_basics() {
    let mut s: HashSet<i32> = HashSet::from([1, 2, 3]);
    s.insert(4);
    s.remove(&2);
    assert!(s.contains(&1));

    let a = HashSet::from([1, 2, 3]);
    let b = HashSet::from([3, 4]);
    let inter: HashSet<_> = a.intersection(&b).copied().collect();
    println!("{inter:?}");
}
```

---

## 4. 其它常用集合（速览）

| 类型 | 场景 |
| --- | --- |
| `BTreeMap` / `BTreeSet` | 需要有序遍历、范围查询 |
| `VecDeque` | 两端高效 push/pop（队列） |
| `BinaryHeap` | 优先队列 |
| `String` | 拥有型 UTF-8 文本；`&str` 是借用视图 |

```rust
use std::collections::{BTreeMap, VecDeque};

fn others() {
    let mut bm = BTreeMap::new();
    bm.insert(2, "b");
    bm.insert(1, "a");
    // 按 key 有序
    let keys: Vec<_> = bm.keys().copied().collect();
    assert_eq!(keys, vec![1, 2]);

    let mut q = VecDeque::from(vec![1, 2, 3]);
    q.push_front(0);
    q.push_back(4);
    assert_eq!(q.pop_front(), Some(0));

    let owned = String::from("hello");
    let view: &str = &owned[0..2]; // "he"（按字节，需落在字符边界）
    let _ = (view, owned);
}
```

`String` 与 `&str`：集合里存 `String` 拥有数据；API 边界多收 `impl AsRef<str>` 或 `&str`，内部再 `.to_string()` / `.into()`。

---

## 5. 结构体

### 5.1 三种形态

```rust
struct Point {
    x: f64,
    y: f64,
}

struct Color(u8, u8, u8); // 元组结构体

struct Marker; // unit 结构体，常作标记类型
```

### 5.2 字段读写与 `impl`

```rust
struct Player {
    name: String,
    hp: i32,
    tags: Vec<String>,
}

impl Player {
    fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            hp: 100,
            tags: Vec::new(),
        }
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn damage(&mut self, amount: i32) {
        self.hp -= amount;
    }

    fn add_tag(&mut self, tag: impl Into<String>) {
        self.tags.push(tag.into());
    }

    fn take_tags(&mut self) -> Vec<String> {
        std::mem::take(&mut self.tags) // 拿走 Vec，留下空 Vec
    }
}

fn struct_usage() {
    let mut p = Player::new("neo");
    p.damage(3);                 // Copy 字段直接改
    p.add_tag("admin");          // 堆字段通过 &mut self 改
    // let n = p.name;           // error：不能移出 name（若还要用 p）
    let n = p.name().to_string();
    let tags = p.take_tags();
    println!("{n}, hp={}, tags={tags:?}", p.hp);
}
```

### 5.3 更新语法与部分移动

```rust
#[derive(Debug)]
struct Config {
    host: String,
    port: u16,
    debug: bool,
}

fn update_syntax() {
    let a = Config {
        host: "localhost".into(),
        port: 8080,
        debug: true,
    };

    // Copy 字段可以在 ..a 时留下 a 仍部分可用的复杂情况；
    // 移动字段被用掉后，a 不能再整体使用。
    let b = Config {
        port: 9090,
        ..a
    };
    // println!("{:?}", a); // error：a.host 已被移走
    println!("{:?}", b);
}
```

---

## 6. 对照专题：简单类型 vs 引用/堆类型

### 6.1 改结构体字段

```rust
struct Both {
    id: u64,            // Copy
    title: String,      // 移动
    items: Vec<i32>,    // 移动
}

fn edit_fields() {
    let mut b = Both {
        id: 1,
        title: "t".into(),
        items: vec![1, 2],
    };

    b.id = 2;                    // OK
    b.title.push_str("-x");      // OK：&mut 字段内部
    b.items.push(3);             // OK

    // 替换堆字段并保住旧值
    let old_title = std::mem::replace(&mut b.title, String::from("new"));
    let old_items = std::mem::take(&mut b.items);

    println!("old_title={old_title}, old_items={old_items:?}, now={:?}", b.id);
}
```

### 6.2 改集合里的结构体

```rust
fn edit_in_vec() {
    let mut list = vec![
        Both {
            id: 1,
            title: "a".into(),
            items: vec![],
        },
        Both {
            id: 2,
            title: "b".into(),
            items: vec![9],
        },
    ];

    // 可变借用某一元素
    if let Some(item) = list.get_mut(0) {
        item.id += 10;
        item.title.push('!');
    }

    // 删除并拿回所有权
    let second = list.remove(1);
    println!("removed id={}, left={}", second.id, list.len());
}
```

### 6.3 错误示范 → 正确写法

**场景 A：在循环里删除 Vec 元素**

```rust
// 错误思路：正序 remove，下标会跳
// 正确：retain，或倒序删，或 drain_filter 风格的 retain

fn remove_even() {
    let mut v = vec![1, 2, 3, 4, 5, 6];
    v.retain(|x| x % 2 != 0);
    assert_eq!(v, vec![1, 3, 5]);
}
```

**场景 B：从 HashMap 取出值再改再放回**

```rust
use std::collections::HashMap;

fn reinsert() {
    let mut m: HashMap<String, Vec<i32>> = HashMap::new();
    m.insert("k".into(), vec![1]);

    // 错误：先 get_mut 又 insert 同一 key，会打架
    // 正确 1：只 get_mut
    if let Some(v) = m.get_mut("k") {
        v.push(2);
    }

    // 正确 2：remove → 改 → insert（需要完整所有权时）
    if let Some(mut v) = m.remove("k") {
        v.push(3);
        m.insert("k".into(), v);
    }
}
```

**场景 C：函数要「改调用方的结构体」**

```rust
fn bump_hp(p: &mut Player, delta: i32) {
    p.hp += delta;
}

fn rename(p: &mut Player, name: String) {
    p.name = name; // 旧 String drop
}

fn consume_name(p: Player) -> String {
    p.name // 整结构体被消费，只返回一个字段
}
```

---

## 7. 易错点

1. **对 `Vec<String>` 写 `let s = v[0]`**——应 `&v[0]`、`v[0].clone()` 或 `v.remove(0)`。
2. **在持有 `&map[k]` 时 `insert` 同一 map**——拆开作用域，或用 `entry`。
3. **`for x in vec` 之后还想用 vec**——那是消费迭代；只需借用时用 `&vec` / `vec.iter()`。
4. **`mem::replace` / `take` 忘记用**——替换堆字段时硬 clone，既慢又易绕晕。
5. **结构体更新 `..old` 后继续用 `old`**——被移动字段会让 `old` 失效。

---

## 8. 小结与下一章

集合负责「装」，结构体负责「造型」，所有权决定「能不能拿出来、改完怎么放回去」。下一章 [引用与智能指针](./03-pointers.md) 会系统讲 `&T`、`Box`、`Rc`/`Arc`、内部可变性，以及它们如何拼进这些数据结构。
