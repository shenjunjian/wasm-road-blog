# 05 · GDScript 语法基础

> 配套 demo：[`godot-demo/05-gdscript-syntax/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/godot-demo/05-gdscript-syntax/)
>
> 截图清单见文末。

第 04 章你见到了所有重要节点，本章起进入 GDScript 本身。**如果你会 Python 或 TypeScript，GDScript 90% 是熟悉的——但有 4~5 个关键差异会绊倒新手**（缩进不可自定义、`Tab` vs `Space`、静态类型系统、`@` 注解、`signal` 是语言关键字等）。这一章系统过一遍 GDScript 的全部基础语法，目标是让你能**读懂本系列后续所有 GDScript 代码**，并能自己写出 200 行以内的脚本。

第 06 章会继续讲静态类型进阶、信号、autoload、运行时 API。本章不涉及"引擎特有"的 API（`Input`、`get_tree()` 等），只讲**语言本身的语法**。

---

## 1. 文件结构与第一行约定

```gdscript
class_name PlayerController        # 可选：全局类名（让其他脚本可以 `var p := PlayerController.new()`）
extends CharacterBody2D            # 必选（除非纯数据）：继承的节点类型，必须是首行或次行

## 文档注释：编辑器里选中 Player类会显示在这里
## 在脚本顶部会作为该 class 的描述。

@warning_ignore("unused_signal")   # 可选：抑制特定 warning
@tool                              # 可选：让脚本在编辑器内也跑（编辑器扩展场景）

# 以下是成员变量与函数
const MAX_HP := 100

@export var hp: int = MAX_HP
@onready var sprite: Sprite2D = $Sprite

func _ready() -> void:
    print("Player ready with hp=", hp)
```

### 1.1 文件的"必备"与"可选"

| 行 | 必需性 | 说明 |
| --- | --- | --- |
| `extends X` | **必选**（脚本挂节点时） | 首行或第二行（第一行若用 `class_name`） |
| `class_name X` | 可选 | 注册为全局类，可以被 `new` 创建、也可以在 Inspector 里拖入 |
| `@tool` | 可选 | 让脚本在编辑器内也执行（小心！会拖慢编辑器） |
| `@warning_ignore(...)` | 可选 | 抑制 IDE 警告 |
| `## ` 文档注释 | 可选 | 编辑器悬浮提示 |

### 1.2 缩进：4 空格（Tab 会被自动转 4 空格）

GDScript 强制缩进表示代码块，**不允许自定义缩进字符**。编辑器默认按 Tab 写入，**Godot 会把 Tab 解释为 4 个空格**（不可改）：

```gdscript
func _ready() -> void:           # ← 不要空格
    if hp < 0:                   # ← 4 空格
        print("dead")            # ← 8 空格
```

**坑**：如果你从网上复制代码，对方的编辑器是 2 空格缩进——粘贴进来 Godot 不会重排，但语义上仍是合法缩进，只是风格不统一。**保持一致即可，不要混用 Tab 和空格**。

---

## 2. 变量与常量

### 2.1 三种声明方式

```gdscript
# 1. 显式类型 + 默认值
var speed: float = 200.0

# 2. 类型推断（:=）—— 等价于第 1 种，只是把类型省略
var speed := 200.0              # 推断为 float

# 3. 动态类型（=）—— 运行时才确定类型，IDE 会给黄色警告
var something = 200             # 黄色警告：UNSAFE_CALL_METHOD_ACCESS 等
```

**类型注解 5 种写法**：

| 写法 | 含义 |
| --- | --- |
| `var x: int` | 声明，无值（默认 0 / null） |
| `var x: int = 0` | 声明 + 默认值 |
| `var x := 0` | 推断类型为 int |
| `var x = 0` | 动态类型（不推荐） |
| `var x: int = some_func()` | 显式声明 + 表达式赋值 |

**类型推断的限制**：

```gdscript
var x := get_node("Foo")    # 推断为 Node（基类），不是子类

# 想拿到子类类型，必须显式注解
var sprite: Sprite2D = $Sprite
```

### 2.2 常量

```gdscript
const MAX_HP := 100             # 类型推断的常量
const NAME: String = "Player"   # 显式类型
const PI := 3.14159

# 常量必须是编译期常量（不能用函数返回值）
const BAD := randi()           # ❌ 编译报错
const OK := 1 + 2              # ✅ 编译期算术
```

### 2.3 可见性（约定）

GDScript **没有真正的 private**。约定俗成：

| 命名 | 含义 |
| --- | --- |
| `_var_name` | 单下划线开头——"内部使用"，编辑器不显示 |
| `__var_name` | 双下划线开头——名字混淆（防止子类覆盖，理论上） |
| 全大写 `MAX_HP` | 常量 |
| 全小写 `max_hp` | 公共变量 |

```gdscript
var hp: int = 100                # 公共
var _internal_state: int = 0     # 内部用
const MAX_HP := 100              # 常量
```

### 2.4 `@export` / `@onready` 等注解

第 02 章讲过 `@export`——把变量暴露到 Inspector。详细注解表在第 06 章展开。常用速查：

```gdscript
@export var x: int = 10                    # 暴露到 Inspector
@export_range(0, 100, 1) var hp: int = 50 # 滑块范围
@export_file("*.tscn") var scene_path: String  # 文件路径
@export_enum("Fire", "Ice") var elem: String   # 枚举下拉
@onready var sprite := $Sprite2D          # _ready 时才赋值
@rpc("any_peer", "call_local", "reliable") func hello():  # 远程调用
```

---

## 3. 函数

### 3.1 函数声明

```gdscript
# 最简单的函数
func greet() -> void:
    print("hi")

# 带参数
func add(a: int, b: int) -> int:
    return a + b

# 默认参数（必须放最后）
func log(msg: String, level: int = 1) -> void:
    print("[%d] %s" % [level, msg])

# 多返回值（用 Array）
func divmod(a: int, b: int) -> Array:
    return [a / b, a % b]

# 可变参数
func sum_all(*nums: int) -> int:
    var s := 0
    for n in nums:
        s += n
    return s
```

### 3.2 函数作为值（Callable）

GDScript 中函数可以赋值给变量、传参、调用——这是信号 connect 的基础（第 06 章）：

```gdscript
func _ready() -> void:
    var f: Callable = Callable(self, "greet")
    f.call()                            # → print("hi")

    # 4.x 推荐写法：方法引用
    var g: Callable = greet
    g.call()                            # 等价

    # Lambda（4.x 新增）
    var add_one := func(x: int) -> int: return x + 1
    print(add_one.call(5))              # → 6
```

### 3.3 生命周期回调（特殊函数名）

这些是 Godot 引擎**按名字识别**的"虚函数"，必须用下划线开头：

| 函数 | 调用时机 |
| --- | --- |
| `_init()` | 节点对象创建时 |
| `_enter_tree()` | 加入场景树 |
| `_ready()` | 自己与子节点都 _enter_tree 完 |
| `_process(delta)` | 每渲染帧 |
| `_physics_process(delta)` | 每物理帧（固定 60 Hz） |
| `_input(event)` | 每输入事件（先于 Control） |
| `_unhandled_input(event)` | UI 没消费才到这 |
| `_unhandled_key_input(event)` | 仅键盘事件 |
| `_exit_tree()` | 离开场景树 |
| `_notification(what)` | 收到引擎通知（详见文档） |

第 02 章讲过完整时序。

### 3.4 静态函数

```gdscript
class_name MathUtil

static func clamp01(v: float) -> float:
    return clampf(v, 0.0, 1.0)

# 调用
print(MathUtil.clamp01(1.5))   # → 1.0
```

---

## 4. 控制流

### 4.1 if / elif / else

```gdscript
if hp <= 0:
    print("dead")
elif hp < MAX_HP / 2:
    print("warning")
else:
    print("healthy")
```

### 4.2 三元运算符

```gdscript
var state := "dead" if hp <= 0 else "alive"
# 等价于
var state: String
if hp <= 0:
    state = "dead"
else:
    state = "alive"
```

### 4.3 match（替代 switch / 模式匹配）

```gdscript
match direction:
    Vector2.UP:
        print("up")
    Vector2.DOWN:
        print("down")
    Vector2.LEFT, Vector2.RIGHT:
        print("horizontal")
    _:
        print("diagonal")   # 默认分支
```

**match 的 4 大用法**：

```gdscript
# 1. 字面值匹配
match keycode:
    KEY_W: print("w")
    KEY_A: print("a")
    _: print("other")

# 2. 多值匹配（逗号分隔）
match v:
    1, 3, 5, 7, 9: print("odd")

# 3. 范围匹配
match score:
    0..59: print("F")
    60..69: print("D")
    70..79: print("C")
    80..89: print("B")
    90..100: print("A")
    _: print("invalid")

# 4. 模式匹配（带变量绑定）
match player:
    {"name": var n, "hp": var h}:
        print("player ", n, " has hp ", h)
    _:
        print("not a player")
```

### 4.4 while

```gdscript
var i := 0
while i < 10:
    print(i)
    i += 1
```

### 4.5 for

```gdscript
# 遍历整数区间 [0, 10)
for i in 10:
    print(i)

# 遍历数组
for item in [1, 2, 3]:
    print(item)

# 遍历字典（拿到的是 key）
for k in {"a": 1, "b": 2}:
    print(k)

# 用 keys() / values() 显式遍历
for v in {"a": 1, "b": 2}.values():
    print(v)

# enumerate-like：拿 index + value
for i in range(arr.size()):
    print(i, arr[i])

# 反向
for i in range(10, 0, -1):
    print(i)
```

### 4.6 break / continue

```gdscript
for i in 100:
    if i == 50:
        break          # 跳出整个循环
    if i % 2 == 0:
        continue       # 跳过本次循环
    print(i)
```

---

## 5. 数据结构

### 5.1 Array（数组）

```gdscript
var arr: Array[int] = [1, 2, 3]       # 类型化数组（推荐）
var dyn: Array = [1, "a", true]       # 动态类型数组

# 常用方法
arr.append(4)              # 末尾追加
arr.push_back(4)           # 同 append
arr.pop_back()             # 末尾弹出
arr.pop_front()            # 头部弹出
arr.insert(0, 0)           # 在位置 0 插入 0
arr.remove_at(2)           # 删除索引 2
arr.erase(2)               # 删除第一个值为 2 的元素
arr.has(3)                 # 是否包含 3
arr.find(3)                # 第一次出现 3 的索引，没有则 -1
arr.size()                 # 长度
arr.is_empty()                 # 是否为空
arr.clear()                # 清空
arr.reverse()              # 反转
arr.sort()                 # 排序（要求元素可比较）
arr.duplicate()            # 浅拷贝
arr.duplicate(true)        # 深拷贝
arr.slice(1, 3)            # 切片 [1, 3)
arr.map(func(x): return x*2)  # 4.x：map / filter / reduce 都是函数式风格
arr.filter(func(x): return x > 0)
arr.reduce(func(acc, x): return acc + x, 0)

# 类型化数组的元素类型必须严格匹配
var arr2: Array[int] = [1, 2, 3]
arr2.append("hi")          # ❌ 编译报错
```

### 5.2 Dictionary（字典）

```gdscript
var d: Dictionary[String, int] = {"hp": 100, "mp": 50}
var dyn: Dictionary = {1: "a", "b": 2}

# 访问
d["hp"]                    # → 100；不存在会抛错
d.get("hp", 0)             # → 100；不存在返回默认值
d.has("hp")                # → true

# 修改
d["hp"] = 200              # 已有 key 则更新
d["gold"] = 50             # 没有则插入

# 删除
d.erase("gold")

# 遍历
for k in d:
    print(k, " = ", d[k])  # k 是 key
for k in d.keys():
    print(k)
for v in d.values():
    print(v)
for k in d.keys():
    var v: int = d[k]
    print(k, v)
```

### 5.3 PackedArray（高效数组）

针对特定基础类型的"紧凑"数组，**内存连续、访问更快**：

| 类型 | 元素类型 | 用途 |
| --- | --- | --- |
| `PackedByteArray` | byte | 二进制、PNG 数据 |
| `PackedInt32Array` | int | 大量整数 |
| `PackedInt64Array` | int64 | 大整数 |
| `PackedFloat32Array` | float | 顶点数据、音频采样 |
| `PackedFloat64Array` | double | 科学计算 |
| `PackedStringArray` | String | 字符串列表 |
| `PackedVector2Array` | Vector2 | 2D 顶点、轨迹点 |
| `PackedVector3Array` | Vector3 | 3D 顶点 |
| `PackedColorArray` | Color | 颜色数组 |

```gdscript
var pts := PackedVector2Array([Vector2(0, 0), Vector2(10, 0)])
pts.append(Vector2(20, 0))
# PackedVector2Array 比 Array[Vector2] 节省 60% 内存（无 Variant 包装）
```

> Line2D、MeshInstance3D 的顶点数组都用 PackedArray——**性能敏感的地方首选 PackedArray**。

### 5.4 Array vs Dictionary 怎么选

| 用 Array | 用 Dictionary |
| --- | --- |
| 元素有顺序 | 需要用 key 查找 |
| 重复元素 | key 唯一 |
| 遍历为主 | 按名字/ID 访问 |
| 数值/数学运算 | 配置数据、状态机 |

---

## 6. 字符串

### 6.1 字符串字面量

```gdscript
var s1 := "普通字符串"
var s2 := '单引号也行'
var s3 := """多行
字符串
支持换行"""
var s4 := r"原始字符串\n不会被转义"   # \n 当字面字符
```

### 6.2 字符串拼接

```gdscript
# 1. % 格式化（最像 C printf）
var s := "hp=%d, name=%s" % [100, "Player"]
print(s)                                # → "hp=100, name=Player"

# 2. format() 大括号占位
var s2 := "hp={hp}, name={name}".format({"hp": 100, "name": "Player"})

# 3. + 拼接（慢，但清晰）
var s3 := "hp=" + str(100)

# 4. f-string 风格（4.x 新增）
var hp := 100
var s4 := f"hp={hp}, name={\"Player\"}"   # 用 f 前缀 + {表达式}
```

### 6.3 常用方法

```gdscript
"hello".length()                  # 5
"hello".to_upper()                # HELLO
"Hello".to_lower()                # hello
"hello".substr(1, 3)              # ell（从 1 开始取 3 个）
"hello".find("ll")                # 2
"hello".split("l")                # ["he", "", "o"]
"  hello  ".strip_edges()         # "hello"
"  hello  ".strip_edges(true, true)  # "hello"（去掉两边）
"abc".replace("a", "X")           # "Xbc"
"hello".is_empty()                # false
"".is_empty()                     # true
"123".to_int()                    # 123
"3.14".to_float()                 # 3.14
"hello".unicode_at(0)             # 'h' 的 Unicode 码点
"h" + "e" + "l" * 3 + "o"         # "hellllo"
```

---

## 7. 运算符

### 7.1 算术

| 运算符 | 含义 | 示例 |
| --- | --- | --- |
| `+` `-` `*` `/` | 加减乘除 | `1 + 2` |
| `%` | 取模 | `5 % 2` → 1 |
| `**` | 幂 | `2 ** 3` → 8 |
| `//` | 整除（向下取整） | `5 // 2` → 2 |
| `+=` `-=` `*=` `/=` `%=` | 自运算并赋值 | `a += 1` |

### 7.2 比较

| 运算符 | 含义 |
| --- | --- |
| `==` `!=` | 等于 / 不等于 |
| `<` `>` `<=` `>=` | 比较 |
| `is` | 类型判断（`x is Node2D`） |
| `in` | 包含（`"x" in "hello"` / `3 in [1,2,3]`） |

> **GDScript 没有 `===`**，因为强类型已经保证类型匹配；想做严格相等用 `is` + `==`。

### 7.3 逻辑

| 运算符 | 含义 |
| --- | --- |
| `and` `or` `not` | 与 / 或 / 非（**不是** `&&` `\|\|` `!`） |
| `&&` `\|\|` `!` | **也支持** C 风格（Godot 4.x 新增） |

```gdscript
if hp > 0 and is_alive:           # 推荐：单词风格
    return
if hp > 0 && is_alive:            # 也行：符号风格
    return
```

### 7.4 位运算

```gdscript
a & b       # AND
a | b       # OR
a ^ b       # XOR
~a          # NOT（按位取反）
a << 1      # 左移
a >> 1      # 右移
```

### 7.5 赋值 vs 比较（Python 用户易混）

```gdscript
var a := 0
if a = 0:        # ❌ 编译报错：条件表达式里写赋值会被禁
    pass
if a == 0:       # ✅ 比较
    pass
```

---

## 8. 注释与文档

### 8.1 普通注释

```gdscript
# 单行注释（井号）

# 多行注释用 #
# 第二行
# 第三行

# 多行字符串当注释（不推荐，会被算作表达式）
# var _unused := """被字符串化的注释"""
```

### 8.2 文档注释 `##`

```gdscript
## 这是文档注释
##
## 第二段会被当作 description 显示在编辑器悬浮提示里。
## 用 [code]highlight[/code]、[b]bold[/b] 等 BBCode。
##
## [param x] 是第一个参数描述
## [param y] 是第二个参数描述
## [return] 返回值描述
func my_func(x: int, y: int) -> int:
    return x + y
```

文档注释会显示在：

- 脚本编辑器悬浮提示
- Inspector 里 `@export` 字段旁
- Ctrl+Shift+F 全局搜索时

---

## 9. 与 Python / TypeScript 的关键差异对照表

> 这张表是给有 Python / TypeScript 经验的开发者的"避坑速查"。

| 维度 | Python | TypeScript | GDScript |
| --- | --- | --- | --- |
| 缩进 | 强制 | 不强制 | 强制，Tab=4 空格 |
| 类型 | 动态 | 静态（编译擦除） | 静态 + 推断 |
| 类型注解 | — | `: type` | `: type` |
| 字符串引号 | `' '` / `" "` | `' '` / `` ` ` `` | `' '` / `" "` |
| 多行字符串 | `"""` | `` ` ` `` | `"""` |
| 原始字符串 | `r""` | — | `r""` |
| f-string | `f""` | `` ` ` `` | `f""`（4.x） |
| 数组 | `[1, 2, 3]` | `[1, 2, 3]` | `[1, 2, 3]` |
| 字典 | `{}` `{"a": 1}` | `{}` `{a: 1}` | `{}` `{"a": 1}` |
| 长度函数 | `len(a)` | `a.length` | `a.size()` 或 `a.length()` |
| 范围 | `range(10)` | — | `range(10)` 或 `10`（4.x） |
| 循环变量作用域 | 泄露到外 | 块作用域 | 块作用域 |
| 默认参数 | `def f(x=1)` | `function f(x=1)` | `func f(x := 1)` |
| 不可变集合 | tuple | `readonly` | 常量 + 类型化 |
| 异常 | `try / except` | `try / catch` | —（GDScript 不支持异常） |
| switch | — | `switch` | `match` |
| lambda | `lambda x: x+1` | `x => x+1` | `func(x): return x+1` 或 `func(x) -> int: return x+1` |
| 空值 | `None` | `null` / `undefined` | `null` |
| 真值 | `True` / `False` | `true` / `false` | `true` / `false` |
| 链式比较 | `0 < x < 10` | ❌ | ❌ |
| 自增 | `i++` | `i++` | **❌** GDScript 没有 `++` / `--` |
| `?` 可选链 | — | `a?.b` | — |
| `??` 空合并 | — | `a ?? b` | `a if a != null else b` |

### 9.1 GDScript 没有的几个常见概念

| 概念 | 替代方案 |
| --- | --- |
| `++` / `--` | `i += 1` / `i -= 1` |
| `try / catch` | 用 `is_instance_valid()` + `assert()`，或写返回错误码的函数 |
| 解构赋值 `a, b = 1, 2` | `var a := 1; var b := 2` |
| 装饰器 `@decorator` | 用 `@export` / `@onready` / `@rpc` 等内置注解；自定义注解可用 `_get_property_list()` 实现 |
| async / await | `await some_signal` / `await get_tree().create_timer(1.0).timeout` |

---

## 10. demo：语法速查手册

demo 放在 `godot-demo/05-gdscript-syntax/`，**故意做成一个"菜单驱动的语法演示器"**——按数字键 1~9 切换到不同语法演示，窗口里显示对应代码与运行结果。

> 截图占位：`<img src="/godot/05-01-script-editor.png" />`（脚本编辑器 + 文档注释 `## ` 的悬浮提示）
> 截图占位：`<img src="/godot/05-02-syntax-highlight.png" />`（GDScript 语法高亮 + 静态类型警告）

### 10.1 文件清单

```
05-gdscript-syntax/
├── README.md
├── project.godot
├── Main.tscn              # 单 Control + Label + script
├── scripts/
│   ├── Main.gd            # 入口：监听数字键切换演示
│   ├── demos/
│   │   ├── DemoBase.gd          # 所有演示的基类
│   │   ├── DemoVarConst.gd      # 变量 / 常量
│   │   ├── DemoFunc.gd          # 函数
│   │   ├── DemoControl.gd       # 控制流
│   │   ├── DemoArray.gd         # 数组
│   │   ├── DemoDict.gd          # 字典
│   │   ├── DemoString.gd        # 字符串
│   │   ├── DemoOperator.gd      # 运算符
│   │   └── DemoLambda.gd        # Callable / lambda
└── icon.svg
```

### 10.2 入口 `Main.gd`

```gdscript
extends Control

## 当前显示的 demo 索引（按数字键切换）
@export var current: int = 0

const DEMOS: Array = [
    preload("res://scripts/demos/DemoVarConst.gd"),
    preload("res://scripts/demos/DemoFunc.gd"),
    preload("res://scripts/demos/DemoControl.gd"),
    preload("res://scripts/demos/DemoArray.gd"),
    preload("res://scripts/demos/DemoDict.gd"),
    preload("res://scripts/demos/DemoString.gd"),
    preload("res://scripts/demos/DemoOperator.gd"),
    preload("res://scripts/demos/DemoLambda.gd"),
]

var _active  # 当前 demo 实例


func _ready() -> void:
    _switch_to(0)


func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        var k: int = (event as InputEventKey).keycode
        if k >= KEY_1 and k <= KEY_9:
            _switch_to(k - KEY_1)


func _switch_to(idx: int) -> void:
    current = clampi(idx, 0, DEMOS.size() - 1)
    if _active:
        _active.queue_free()
    _active = DEMOS[current].new()
    add_child(_active)
    print("--- Demo %d ---" % current)
    _active.run()
```

### 10.3 demo 基类与示例

```gdscript
# scripts/demos/DemoBase.gd
extends Node

## 所有 demo 的基类：实现 run() 方法即可
func run() -> void:
    pass
```

```gdscript
# scripts/demos/DemoVarConst.gd
extends Node

func run() -> void:
    print("== 变量 / 常量 ==")

    # 显式类型
    var hp: int = 100
    print("hp (int) = ", hp)

    # 类型推断
    var speed := 200.0
    print("speed (inferred float) = ", speed)

    # 动态类型（IDE 警告）
    var dyn = "hello"
    print("dyn (dynamic) = ", dyn)

    # 常量
    const MAX_HP := 100
    print("MAX_HP = ", MAX_HP)
```

```gdscript
# scripts/demos/DemoArray.gd
extends Node

func run() -> void:
    print("== Array / Dictionary ==")

    var arr: Array[int] = [3, 1, 4, 1, 5]
    print("original: ", arr)
    arr.sort()
    print("sorted:   ", arr)

    # 函数式
    var doubled: Array = arr.map(_double)
    print("doubled:  ", doubled)

    var d: Dictionary = {"hp": 100, "mp": 50}
    for k in d:
        print("  %s = %d" % [k, d[k]])


func _double(x: int) -> int:
    return x * 2
```

```gdscript
# scripts/demos/DemoString.gd
extends Node

func run() -> void:
    print("== 字符串 ==")

    var hp: int = 100
    var name: String = "Player"

    # 三种格式化
    print("1. % 格式化: " + "hp=%d, name=%s" % [hp, name])
    print("2. format() : " + "hp={hp}, name={name}".format({"hp": hp, "name": name}))
    print("3. f-string: hp=%d, name=%s" % [hp, name])  # GDScript 没有真 f-string,这里用 % 模拟

    # 多行字符串
    var multi := """
第一行
第二行
行尾保留缩进
"""
    print("multi-line length: ", multi.length())
```

```gdscript
# scripts/demos/DemoLambda.gd
extends Node

func run() -> void:
    print("== Callable / Lambda ==")

    # 方法引用
    var c1: Callable = _double
    print("c1.call(5) = ", c1.call(5))

    # Lambda
    var c2: Callable = func(x: int) -> int: return x * 3
    print("c2.call(5) = ", c2.call(5))

    # 作为参数
    var arr: Array = [1, 2, 3]
    var result: Array = arr.map(func(x): return x + 10)
    print("arr + 10 = ", result)


func _double(x: int) -> int:
    return x * 2
```

> 其余 Demo（Func / Control / Dict / Operator）写法类似，每个 10~15 行 print。完整源码在 demo 仓库里。

### 10.4 启动方式

按 **数字键 1~9** 切换演示。每次切换会用 `_active.queue_free()` 销毁上一个 demo 实例，再 `new()` 新实例。Output 面板会打印运行结果。

---

## 11. 易错清单

| 现象 | 原因 |
| --- | --- |
| `Indent error` | 缩进混用 Tab 与空格；或缩进不是 4 的倍数 |
| `Identifier already declared as function` | 函数名与变量名重复 |
| `Function "X" not found in base self` | 调用了未声明或拼错的函数 |
| `Invalid get index 'x' (on base: 'Dictionary')` | Dictionary 用 `.x` 而非 `["x"]` |
| `Out of range get index` | Array 越界（`arr[100]` 当 size=10） |
| 类型不匹配警告（黄色） | 函数参数类型不对；不是错误但建议修 |
| `await` 不工作 | 表达式不是 signal；`await get_tree().create_timer(...)` 才合法 |
| `match` 没默认分支 | 没有 `_:` 分支且输入未匹配 |

---

## 12. 章节小结

- **文件结构**：`extends` 必须，`class_name` 可选；Tab=4 空格强制缩进
- **变量**：`:= / 类型注解 / 动态类型` 三档；下划线前缀表私有
- **函数**：声明、`Callable`、lambda、生命周期回调（`_ready` / `_process` / `_physics_process`）
- **控制流**：`if / elif / else`、三元、`match`（支持多值/范围/模式）、`while / for / break / continue`
- **数据结构**：`Array[T]` / `Dictionary[K,V]` / `PackedArray` / 函数式 `map/filter/reduce`
- **字符串**：`%` / `format()` / `f""` / 多行 / 原始
- **运算符**：算术、比较、逻辑（单词或符号）、位运算
- **GDScript 没有**：`++ / try-catch / 解构 / async` —— 用 `+=1 / is_instance_valid / 多变量 / await 信号` 替代
- **与 Python/TS 关键差异**：缩进、`size()` vs `length()`、`null` vs `None`、`is` 类型判断、`await` 信号

下一章 [06 · GDScript 进阶、信号与运行时 API](./06-gdscript-advanced.md) 我们接着讲：静态类型深度、信号系统、autoload 单例、节点查询与运行时 API。读完你才算把 GDScript + Godot 引擎 API 都拿到手。

---

## 📷 本章截图清单

| 文件名 | 内容 | 截屏步骤 |
| --- | --- | --- |
| `05-01-script-editor.png` | 脚本编辑器 + 文档注释 `## ` 的悬浮提示 | 打开 Main.gd，把鼠标停在 `## ` 注释行 |
| `05-02-syntax-highlight.png` | GDScript 语法高亮 + 静态类型警告（黄色边） | 故意写一行动态类型 `var x = ...`，看编辑器警告标记 |