# 05 · GDScript 语法速查演示器

> 对应博客：[05 · GDScript 语法基础](../../blog-vp-site/godot/05-gdscript-syntax.md)

## 启动

1. 用 Godot 4.3+ 打开本目录里的 `project.godot`。
2. 按 **F5**。窗口里显示当前 demo 的运行结果（RichTextLabel 自动滚动到底）。
3. 按 **数字键 1~8** 切换演示。切换会立刻清空并执行新 demo。

## 演示列表

| 按键 | 演示 | 涵盖 |
| --- | --- | --- |
| `1` | 变量 / 常量 | `var` 三档、`:=` 推断、`const`、`_` 前缀 |
| `2` | 函数 | 默认参数、多返回值（Array）、函数参数 |
| `3` | 控制流 | `if / elif / else`、`match`（多值+Vector2）、`for in 5`、`range()` |
| `4` | Array | 类型化 `Array[int]`、`sort`、`map / reduce / filter`（lambda） |
| `5` | Dictionary | `keys / values`、`get` 带默认值、`erase` |
| `6` | 字符串 | `%` 格式化、`format()`、`"""` 多行 |
| `7` | 运算符 | `** // %`、比较、`is` 类型判断、三元、位运算 |
| `8` | Callable / Lambda | 方法引用、`func(x): ...` lambda、`Array.map` 接 lambda |

## 关键文件

```
05-gdscript-syntax/
├── README.md
├── project.godot
├── icon.svg
├── Main.tscn           # Control + Label + RichTextLabel + 脚本
└── Main.gd             # 单脚本实现 8 个演示函数 + 切换逻辑
```

## 自己动手改一改

| 想验证的现象 | 改法 |
| --- | --- |
| 加第 9 个 demo | 在 `DEMO_NAMES` 加一行 + 在 `match` 加一个分支 + 写 `_demo_xxx()` |
| 显示改成中文 | `_output.append_text(...)` 里字符串改中文 |
| 关键字高亮 | 改用 `[color=#xxx]...[/color]` BBCode 包关键字 |
| 让 demo 持久显示 | 注释掉 `_unhandled_input` 里的切换 |

## 关键观察点

- **`@export var current: int = 0`**：运行起来后，你可以在编辑器里选中 Main 节点，把 Inspector 里的 `Current` 改成 5（字符串 demo），下次运行就会直接显示字符串那一栏
- **`match current`**：GDScript 4.x 的 `match` 支持整数字面量，且无需 default 分支也可以编译通过
- **`Array[int].map(func)`**：map 的回调签名由 lambda 决定，IDE 会按 `Callable` 推断
- **RichTextLabel 自动滚动**：`scroll_following = true` 让新追加的内容自动滚到底