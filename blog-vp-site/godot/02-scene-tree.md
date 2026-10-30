# 02 · 核心概念：场景、节点、树与继承

> 配套 demo：[`godot-demo/02-scene-tree/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/godot-demo/02-scene-tree/)
>
> 截图清单见文末。

第 01 章你跑通了一个会动的小方块，但那只是一个根节点 + 一个子节点的"小破树"。这一章把整棵"参天大树"的每一层都拆给你看：节点是什么、场景怎么保存、实例化和继承到底发生了什么、节点什么时候被引擎叫醒、什么时候被销毁。**这是整个 Godot 引擎的认知地基**——后面 10 章所有 API、所有 Inspector 字段，背后都跳不出这一章的 4 个名词。

---

## 1. 这一章要建立的 4 个核心名词

读之前先记住这一章会出现 4 个最容易被混淆的术语，后面每节都会反复回到这张表：

| 名词 | 是什么 | 存在形式 |
| --- | --- | --- |
| **节点（Node）** | 引擎里**一个对象**，有类型、可以挂脚本、有父子关系、有生命周期回调 | 运行时内存里的一坨数据 |
| **场景（Scene）** | **以某个节点为根的整棵子树**，保存到磁盘 | `.tscn` 文件（文本格式） |
| **实例（Instance）** | 运行时**父场景里嵌入的子场景** | 父场景树里的某棵子树 |
| **继承场景（Inherited Scene）** | 编辑器里**基于父场景做覆写**生成的子场景 | 磁盘上另一个 `.tscn`，带 `inherit` 字段 |

最容易踩的坑：把「场景」和「实例」混用、把「继承」和 OOP 语言的"class 继承"搞混。下面逐个拆。

---

## 2. 节点（Node）：Godot 世界的"最小单位"

```text
┌──────────────────────────────────────────────────────────────────┐
│ Node                                                              │
│                                                                  │
│  - 名字（name）           "Player" / "Enemy" / "Sprite2D"         │
│  - 类型（class）          Node2D / Sprite2D / Timer / ...          │
│  - 父节点引用（parent）    一个 Node？或 null（自己就是根）        │
│  - 子节点列表（children）  Array[Node]，可空可多                  │
│  - 挂载的脚本（script）    一个 .gd 文件？或 null                  │
│                                                                  │
│  生命周期回调（virtual methods）：                                │
│    _init()              new 出来时调用一次                       │
│    _enter_tree()        加入场景树时调用                        │
│    _ready()             自己和所有子节点都进树后调用一次          │
│    _process(delta)      每渲染帧（默认 60fps，可变）              │
│    _physics_process(d)  每物理帧（固定 60Hz，不可变）            │
│    _input(event)        每输入事件                                │
│    _exit_tree()         离开场景树时调用                          │
│    _unhandled_input(e)  UI 没消费的输入事件                       │
└──────────────────────────────────────────────────────────────────┘
```

**节点不是 Object 的子类——它就是 Object 的子类**。Godot 用 C++ 实现了一套引用计数 + 信号系统的 Object 体系，Node 是其中最核心的一个子类。

> 关键认知：**节点类型决定它能干什么**。`Sprite2D` 节点能挂贴图、`Timer` 节点能定时发信号、`AudioStreamPlayer` 节点能播音频——它们都是从 Node 派生的子类。**节点本身没有"功能"，功能都在子类里**。

打开编辑器按 `Ctrl + Shift + F`（全局搜索）随便搜个节点类型如 `CharacterBody2D`，会跳到「Class CharacterBody2D」文档页。文档左侧能看到完整的继承链：

```text
RefCounted
└── Object
    └── Node
        └── CollisionObject2D
            └── PhysicsBody2D
                └── CharacterBody2D
```

继承链决定了节点能"做"什么——CharacterBody2D 从 PhysicsBody2D 继承，所以有物理体属性；PhysicsBody2D 从 CollisionObject2D 继承，所以有 layer/mask；CollisionObject2D 从 Node 继承，所以有生命周期回调。

### 2.1 节点 = 数据 + 引用 + 回调

一个节点在内存里就是这样的：

```gdscript
# 等价的伪代码
class Node:
    var name: StringName              # 节点名（不是唯一）
    var parent: Node?                  # 父引用
    var children: Array[Node]          # 子列表
    var script: Script?                # 挂载的 GDScript
    var properties: Dictionary         # 所有 Inspector 属性（含继承的）

    func _enter_tree() -> void: pass
    func _ready() -> void: pass
    func _process(delta: float) -> void: pass
    # ...
```

注意 Godot 的节点**没有私有变量**——所有以 `_` 开头的只是约定俗成的"私有"标记，编辑器不会在 Inspector 显示它们。所有变量都能在 Inspector 里看到、能用 `@export` 暴露出来。

### 2.2 节点的命名（Unique Name）

节点名有两个独立的概念，初学者一定要分清：

| 概念 | API | 作用 |
| --- | --- | --- |
| **name**（节点名） | `$NodeName` 或 `get_node("NodeName")` | 在同级兄弟里查找 |
| **scene_unique_name**（唯一名） | `%UniqueName` 或 `get_node("%UniqueName")` | 跨整棵子树查找 |

唯一名的设置方法：在 Scene Dock 里**右键节点 → Access as Unique Name**（图标会变）。如果场景里有两个同名节点（实际场景中很常见，比如多个 `Sprite2D`），用 `$` 会报错或拿到第一个，但 `%` 一定拿到那个唯一名节点。

> **截图占位**：`<img src="/godot/02-01-scene-tree.png" />`（一个 4~5 层深度的复杂场景树——展示 `$` vs `%` 的差异）

---

## 3. 场景（Scene）：一棵树就是一个文件

```text
        Main.tscn
        ┌──────────────────────────────────┐
        │ Main (Node2D)         ← root    │
        │   ├── Background (Sprite2D)     │
        │   ├── Player (CharacterBody2D)  │
        │   │   ├── Sprite (%Body)        │
        │   │   ├── CollisionShape2D      │
        │   │   └── Gun (Sprite2D)        │
        │   └── UI (CanvasLayer)          │
        │       ├── HUD (Control)         │
        │       └── PauseMenu (Control)   │
        └──────────────────────────────────┘
```

`.tscn` 文件**本质上就是这棵树的序列化**。打开 `01-overview/Main.tscn`：

```ini
[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://Main.gd" id="1_main"]
[ext_resource type="Texture2D" path="res://icon.svg" id="2_icon"]

[node name="Main" type="Node2D"]
script = ExtResource("1_main")

[node name="Sprite2D" type="Sprite2D" parent="."]
position = Vector2(640, 360)
texture = ExtResource("2_icon")
```

每一段：

- `[ext_resource]`：外部资源（脚本、贴图、其它场景），用 `id` 引用
- `[node name="..." type="..."]`：一个节点
- `parent="."`：父节点路径，`.` 表示父场景/根节点，`"X/Y"` 表示相对根的子节点路径
- 缩进表示父子关系（也用 `parent` 字段明文写）

**关键事实**：场景里的节点属性是**编辑器最后一次保存时的快照**。运行时改 `position.x` 不会回写 `.tscn`（除非你手动调用 `ResourceSaver.save`）。

> **场景 vs 预制体（Prefab）**：Unity 的 Prefab 是单独资产，引用到场景里。Godot 的"场景"和"预制体"是**同一个东西**——一个 `.tscn` 文件既是独立资产，也可以实例化到别的场景里。没有"预制体"这个独立概念。

---

## 4. 场景树（SceneTree）：运行时整棵游戏世界的根

编辑器里你看到的"Scene Dock"是当前打开的那个场景的树。**运行时整棵游戏世界**——所有加载进来的场景、所有 autoload、所有手动 add_child 的节点——它们的共同根叫 **`SceneTree`**。

> 截图占位：`<img src="/godot/02-02-scenetree-runtime.png" />`（F5 运行后 Debugger → Remote 面板看到的运行时 SceneTree——会列出 autoload + main scene + 所有 add_child 的节点）

SceneTree 这个节点本身是 Node 的子类，但**它不能挂脚本**（因为它在所有节点之前就存在了）。它有几个关键 API：

```gdscript
# 当前 SceneTree 在任何节点里都能拿到
get_tree()                  # → SceneTree
get_tree().current_scene    # → 当前主场景的根节点
get_tree().root             # → 整棵树的根（Viewport 节点）
get_tree().paused           # → bool，游戏是否被暂停
get_tree().quit()           # → 退出游戏
get_tree().change_scene_to_file("res://Next.tscn")  # 切场景
get_tree().create_timer(2.0)  # 创建一次性定时器
```

**切场景会发生什么**：

1. 当前主场景的所有节点 `_exit_tree()` 被调用
2. 当前主场景被释放（引用计数 → 0 → 销毁）
3. 新场景从 `.tscn` 反序列化，新节点的 `_enter_tree()` → `_ready()` 被依次调用

如果旧场景里有些对象你不想释放（比如背景音乐），就要用 autoload 单例（第 06 章讲）或 `process_mode`。

---

## 5. 实例化（Instancing）：把别人家的树挂到自家树上

实例化是 Godot 实现"复用"的核心机制。把任何一个 `.tscn` 当成"组件"，实例化到另一个场景里：

> 截图占位：`<img src="/godot/02-03-instance.png" />`（把 Bullet.tscn 实例化到 Player.tscn 里——编辑器里能看到一个折叠的 Bullet 节点）

### 5.1 编辑器里手动实例化

最常用的做法：把 `.tscn` 文件**从 FileSystem 拖进 Scene Dock**。编辑器会自动创建一个子节点，节点名 = 文件名（去掉 `.tscn`）。

效果：

```text
Player.tscn
└── Player (CharacterBody2D)
    ├── Sprite2D
    └── BulletInstance (Bullet.tscn)   ← 实例化进来的子场景
        ├── Sprite (Sprite2D)
        └── CollisionShape2D
```

注意 `BulletInstance` 节点本身**显示类型就是它实例化的那个场景的根类型**（假设 Bullet 的根是 `RigidBody2D`，那这里就是 RigidBody2D）。**编辑器左侧图标会带个"折叠"标记**，表示它是一个实例化进来的场景——点开可以临时"打开子场景"修改，但**不要在父场景里直接改实例化的子节点属性**——那是覆盖，下次重载父场景会被覆盖逻辑处理。

### 5.2 脚本里动态实例化

```gdscript
# Main.gd
const BulletScene := preload("res://Bullet.tscn")  # 预加载（启动时就载入）

func shoot() -> void:
    var bullet = BulletScene.instantiate()        # 创建一个实例
    bullet.position = global_position
    bullet.direction = Vector2.RIGHT
    add_child(bullet)                              # 挂到当前节点下
```

`preload()` 在脚本编译时执行，把 `.tscn` 加载到常量里，运行时不重复读盘。`instantiate()` 才会真正在内存里建一棵树。

### 5.3 实例化的"覆盖"机制（重写 vs 修改）

**关键问题**：实例化进来的子场景，我能在父场景里改它内部某个节点的属性吗？

答：**可以，但有限制**。

- ✅ 在父场景 Inspector 里看到子节点所有"可导出"属性（带 `@export` 或节点本身 Inspector 字段）
- ✅ 修改后字段变橙色——表示"被父场景覆写"
- ❌ 子场景内部的脚本代码改不了——代码是只读的
- ❌ 子场景内部的子结构改不了——加新节点不行、删节点不行

这是非常聪明的设计：

- **子场景 = 公共模板**：作者维护代码与结构
- **父场景 = 配置与编排**：使用者只调参数与连接信号

后续章节会反复用这个机制：第 04 章批量创建敌人、第 06 章连接信号、第 08 章把 AnimationPlayer 当组件挂到不同角色上。

---

## 6. 继承场景（Inherited Scene）：模板的"家族分支"

继承场景和"实例化"听起来像，但**机制完全不同**：

| 维度 | 实例化（Instancing） | 继承（Inherit） |
| --- | --- | --- |
| 父场景的角色 | 模板（资产） | 基类（蓝图） |
| 产物 | 父场景里多出一个节点 | **磁盘上一个新的 `.tscn`** |
| 改父场景是否影响？ | 影响（子节点是引用） | 不影响（独立磁盘文件） |
| 改子场景是否影响父？ | 不影响（被冻结） | **会影响**（覆盖层机制） |
| 类比 | CSS 的 @import | OOP 的 class extends |

### 6.1 创建继承场景

> 截图占位：`<img src="/godot/02-04-inherit.png" />`（在 Enemy.tscn 上右键 → New Inherited Scene，生成 EnemyOrc.tscn）

操作：在 Scene Dock 里**右键某个节点 → New Inherited Scene**（或在 FileSystem 里右键 `.tscn` 文件）。编辑器会：

1. 弹保存对话框，存为新 `.tscn`
2. 切到新场景，标题栏显示 `[Inherited from Enemy.tscn]`
3. 节点图标带 📄 标记

### 6.2 改父场景 vs 改子场景

```text
Enemy.tscn  (基类)
├── Sprite2D  texture=orc.png

EnemyOrc.tscn  (继承自 Enemy)
├── Sprite2D  texture=orc.png  ← 沿用父（白色）
└── Sprite2D  texture=orc_red.png  ← 覆盖（橙色）

EnemyElf.tscn (继承自 Enemy)
└── Sprite2D  texture=elf.png  ← 覆盖（橙色）
```

- **改 Enemy.tscn 的 Sprite2D 贴图**：三个子场景**都受影响**（因为它们沿用）
- **改 EnemyOrc.tscn 内部的覆盖属性**：只影响 Orc，不影响 Elf，不影响 Enemy

这就是"游戏开发中的 OOP"——一个 `Enemy` 基类场景，Ogre / Elf / Goblin 各继承一份，各自定义贴图、属性、AI 行为覆盖。

### 6.3 编辑器会保护你不乱改

在 EnemyOrc.tscn 里尝试**新增 / 删除子节点**——编辑器会禁用。**继承场景只能"覆写属性"和"挂额外脚本引用"**，不能改结构。要改结构，必须回到父场景。

> **常见误区**：很多新手把"实例化"和"继承"混为一谈。记住一句：
> - **实例化**：父场景嵌入子场景的实例（N 份独立内存）
> - **继承**：父场景作为蓝图，复制出一份独立磁盘文件（共享更新）

---

## 7. `@export`：把节点引用从代码里解放出来

第 01 章你见了 `@export var speed`，那是把**值**暴露到 Inspector。更强大的用法是把**节点引用**也暴露出去：

### 7.1 反面例子：硬编码 NodePath

```gdscript
# 难维护的写法
func _ready() -> void:
    var sprite = $Sprite2D           # 写死路径
    var body    = $"Body/Sprite"     # 嵌套路径
    var gun     = $Gun               # 同级

func shoot() -> void:
    gun.fire()                       # 改名 Gun → FirePoint 就崩了
```

### 7.2 推荐做法：`@export` + 拖拽绑定

```gdscript
extends Node2D

# @export + 类型注解 → Inspector 显示为可绑定字段
# 把场景树里的节点拖到这个字段上，编辑器自动记录 NodePath
@export var body: Sprite2D
@export var gun: Node2D

# 也可以绑资源
@export var fire_sound: AudioStream
@export var bullet_scene: PackedScene

func shoot() -> void:
    if gun:
        gun.fire()
    if bullet_scene:
        var b = bullet_scene.instantiate()
        add_child(b)
```

> 截图占位：`<img src="/godot/02-05-inspector-export.png" />`（Inspector 里的 `@export` 字段——把 Sprite2D 节点拖到字段上变成 NodePath 绑定）

### 7.3 `@export` 能导出的类型

| 注解 | 字段类型 | Inspector 显示 |
| --- | --- | --- |
| `@export var x: int = 0` | 基础类型 | 文本框 / 滑块 |
| `@export_range(0, 100, 1) var hp: int` | 带范围 | 滑块 |
| `@export var node: Node2D` | 节点引用 | 拖拽绑定 |
| `@export var texture: Texture2D` | 资源 | 文件选择器 |
| `@export_file("*.tscn") var scene_path` | 文件路径 | 文本框 |
| `@export_enum("Fire", "Ice", "Lightning") var elem` | 枚举 | 下拉框 |
| `@export_group("Combat")` | 分组 | 折叠组 |
| `@export_flags("Fire:1", "Ice:2") var elem` | 位掩码 | 多选 |

`@export` + Node 引用 + Inspector 拖拽，**是 Godot 工作流的核心**。比硬编码 NodePath 灵活太多——重命名节点、改结构都不用改代码。

---

## 8. 节点生命周期：引擎什么时候叫你

`@export` 是静态配置，生命周期是**运行时序**。理解 Godot 节点什么时候被叫，比记 API 更重要。

### 8.1 完整生命周期时序

```text
                      实例化 / instantiate()
                          │
                          ▼
                  ┌──────────────┐
                  │  _init()     │   ← Object 构造期（节点没进树）
                  └──────┬───────┘
                         │ add_child()
                         ▼
                  ┌──────────────┐
                  │ _enter_tree()│   ← 加入 SceneTree
                  └──────┬───────┘
                         │ 自己和所有子节点都 _enter_tree 完
                         ▼
                  ┌──────────────┐
                  │ _ready()     │   ← 可以安全访问子节点、get_tree()
                  └──────┬───────┘
                         │
            ┌────────────┴─────────────┐
            │                          │
            ▼                          ▼
   ┌─────────────────┐       ┌─────────────────────┐
   │ _process(delta) │       │ _physics_process(d) │
   │ 每渲染帧         │       │ 每物理帧 (固定 60Hz)  │
   └─────────────────┘       └─────────────────────┘

            一直循环直到节点从树里移除
                         │
                         │ remove_child() 或 free()
                         ▼
                  ┌──────────────┐
                  │ _exit_tree() │   ← 离开 SceneTree
                  └──────┬───────┘
                         │ 引用计数归零
                         ▼
                       free
```

### 8.2 五个常用回调的语义对比

| 回调 | 调用时机 | 调用次数 | 用途 |
| --- | --- | --- | --- |
| `_init()` | 节点对象创建时（`instantiate()` / `new()`） | 1 次 | 初始化成员变量 |
| `_enter_tree()` | 加入 SceneTree（即使被移出再移入会再调） | 多次 | 注册信号、连接外部服务 |
| `_ready()` | 自己和所有子节点都 `_enter_tree` 后 | 1 次（除非移出再入） | 拿子节点引用、做依赖初始化 |
| `_process(delta)` | 每渲染帧，**频率可变**（60~144 FPS） | 每帧 | UI、相机、视觉相关 |
| `_physics_process(delta)` | 每物理帧，**固定 60 Hz**（可在 Project Settings 改） | 每帧 | 物理移动、碰撞检测 |
| `_exit_tree()` | 离开 SceneTree（移出/释放） | 1 次 | 反注册、清理订阅 |

### 8.3 关键陷阱：`_ready` 时子节点未必 `_ready`

```gdscript
# 父节点的 _ready 先调用，还是子节点的 _ready 先调用？
# 答：子节点先！

# 如果你在父 _ready 里调用子节点的方法，而那个子节点依赖 _ready 初始化…
# 会出问题。正确做法：用 _enter_tree（深度优先，从根到叶）或用 signal。
```

具体时序：

```text
_root._enter_tree()
  child._enter_tree()
    grandchild._enter_tree()
  child._ready()         ← 子先 ready
    grandchild._ready()  ← 孙子再 ready
_root._ready()           ← 父最后 ready
```

`_ready` 是**深度优先**的——叶子节点先 ready，根节点最后 ready。

### 8.4 `_process` vs `_physics_process`：选哪个

```gdscript
# ❌ 错误：在 _process 里移动 CharacterBody
func _process(delta: float) -> void:
    position.x += speed * delta          # 帧率波动会不一致
    move_and_slide()                     # 物理调用会卡顿

# ✅ 正确：物理相关在 _physics_process 里
func _physics_process(delta: float) -> void:
    velocity.x = speed * Input.get_axis("ui_left", "ui_right")
    move_and_slide()

# ✅ 视觉相关（粒子、动画相机）在 _process 里
func _process(delta: float) -> void:
    $Particles.emitting = Input.is_action_pressed("ui_accept")
```

为什么？物理引擎内部按 60 Hz 模拟重力与碰撞，**如果你的移动代码跑在 144 FPS 的渲染帧上**，会形成"144 次不规则推动 vs 60 次规则推动"的差异，导致穿墙或速度不稳。

### 8.5 `process_mode`：暂停 / 跨场景保持行为

节点可以被暂停（`get_tree().paused = true`）。`process_mode` 决定这个节点在暂停时是否还跑：

| 值 | 行为 |
| --- | --- |
| `PROCESS_MODE_INHERIT` | 跟随父节点（默认） |
| `PROCESS_MODE_PAUSABLE` | 暂停时停 |
| `PROCESS_MODE_WHEN_PAUSED` | 只在暂停时跑（适合暂停菜单） |
| `PROCESS_MODE_ALWAYS` | 永远跑（适合背景音乐、autoload） |
| `PROCESS_MODE_DISABLED` | 完全停 |

---

## 9. demo：场景、实例化、继承、生命周期一锅端

demo 放在 `godot-demo/02-scene-tree/`，故意做成一个能跑能玩的"玩具"——一个玩家方块，键盘左右移动，发射子弹，子弹会自动飞。

> 截图占位：`<img src="/godot/02-06-demo-running.png" />`（demo 运行中——窗口里有玩家方块和若干飞行子弹）

### 9.1 文件清单

```
02-scene-tree/
├── README.md
├── project.godot
├── Main.tscn               ← 主场景：玩家 + 子弹发射器
├── Player.tscn             ← 玩家场景（Sprite2D + 脚本）
├── Bullet.tscn             ← 子弹场景（Area2D + 脚本）
└── scripts/
    ├── Main.gd             ← 处理输入、生成子弹
    ├── Player.gd           ← 移动
    └── Bullet.gd           ← 自动飞行 + 出界销毁
```

### 9.2 关键场景文件

`Player.tscn`：

```ini
[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/Player.gd" id="1"]
[ext_resource type="Texture2D" path="res://icon.svg" id="2"]

[node name="Player" type="CharacterBody2D"]
script = ExtResource("1")
speed = 320.0

[node name="Sprite" type="Sprite2D" parent="."]
texture = ExtResource("2")
```

`Bullet.tscn`：

```ini
[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/Bullet.gd" id="1"]
[ext_resource type="Texture2D" path="res://icon.svg" id="2"]

[node name="Bullet" type="Area2D"]
script = ExtResource("1")
speed = 600.0

[node name="Sprite" type="Sprite2D" parent="."]
scale = Vector2(0.3, 0.3)
texture = ExtResource("2")
```

`Main.tscn`：

```ini
[gd_scene load_steps=4 format=3]

[ext_resource type="Script" path="res://scripts/Main.gd" id="1_main"]
[ext_resource type="PackedScene" path="res://Player.tscn" id="2_player"]
[ext_resource type="PackedScene" path="res://Bullet.tscn" id="3_bullet"]

[node name="Main" type="Node2D"]
script = ExtResource("1_main")

[node name="Player" parent="." instance=ExtResource("2_player")]
position = Vector2(640, 500)

[node name="BulletContainer" type="Node2D" parent="."]
```

注意 `instance=ExtResource("2_player")`——这就是**编辑器实例化的底层表达**：父场景里嵌入子场景的引用。

### 9.3 关键脚本

```gdscript
# scripts/Main.gd
extends Node2D

@export var bullet_scene: PackedScene = preload("res://Bullet.tscn")  # Inspector 拖入更直观；忘了拖就用 preload 兜底
@export var fire_rate: float = 0.2                                     # 秒/发
@onready var player: CharacterBody2D = $Player
@onready var bullets: Node2D = $BulletContainer

var _fire_cd: float = 0.0

func _process(delta: float) -> void:
    _fire_cd -= delta
    if Input.is_action_pressed("ui_accept") and _fire_cd <= 0.0:
        _fire()
        _fire_cd = fire_rate

func _fire() -> void:
    var b: Node2D = bullet_scene.instantiate()
    bullets.add_child(b)
    b.global_position = player.global_position + Vector2(0, -40)
```

```gdscript
# scripts/Player.gd
extends CharacterBody2D

@export var speed: float = 320.0

func _physics_process(delta: float) -> void:
    var dir := Input.get_axis("ui_left", "ui_right")
    velocity.x = dir * speed
    move_and_slide()
```

```gdscript
# scripts/Bullet.gd
extends Area2D

@export var speed: float = 600.0

func _physics_process(delta: float) -> void:
    position.y -= speed * delta
    if position.y < -40:
        queue_free()      # 安全释放：当前帧结束后销毁
```

### 9.4 用到的所有概念

| 概念 | 在 demo 哪里出现 |
| --- | --- |
| 节点（Node） | 每个 `.tscn` 里的节点都是 |
| 场景（Scene） | Player.tscn / Bullet.tscn / Main.tscn 各自独立 |
| 实例化（Instance） | Main.tscn 把 Player.tscn 实例化进来 |
| PackedScene + preload | Main.gd 预加载 Bullet 场景 |
| `@export` 节点引用 | Main.gd 里 `bullet_scene: PackedScene` 拖入 |
| `@onready` | Main.gd 里 `player = $Player` |
| `_process` vs `_physics_process` | Main 用 _process（输入），Player / Bullet 用 _physics_process（物理移动） |
| `queue_free()` | Bullet 出界后安全销毁 |

---

### 9.5 在编辑器里手把手复现

> 这一节假设你**没有用现成的 `godot-demo/02-scene-tree/` 工程**，而是想从空编辑器自己点一遍。所有步骤都在 Godot 4.3+ 标准版（不要用 .NET 版）下验证过。
>
> 完成这一节你不需要复制上面 9.2 / 9.3 任何代码——编辑器会自动生成内容相同的 `.tscn` 和 `.gd`。

#### 9.5.1 创建新项目

1. 启动 Godot 4.3+，进入 Project Manager。
2. 右上角 **New Project** → **Create Folder** 选一个空目录（比如 `~/godot-sandbox`）→ 命名项目（比如 `02-scene-tree`）→ **Create & Edit**。
3. 编辑器打开后，左上角 Scene Dock 是空的，FileSystem 面板只有一个 `icon.svg` 和 `project.godot`。
4. **Project → Project Settings**：
   - `Application/Run/Main Scene`：暂时留空（等做完 `Main.tscn` 再回来填）
   - `Display/Window/Viewport Width = 1280`、`Height = 720`
   - 点右上角 **×** 关掉 Project Settings。

> **为什么要先关 Project Settings**？Godot 的 Project Settings 是**写回 `project.godot` 文件**的——你拖窗口、调字段它都会回写磁盘。先关掉避免后面被自动写脏。

#### 9.5.2 创建 `Player.tscn`

1. Scene Dock 顶部 **+** 按钮（或菜单 Scene → New Scene）。
2. 弹出的 Create New Node 对话框，搜索 `CharacterBody2D` → 选中 → **Create**。
3. 根节点重命名为 `Player`（Scene Dock 顶部节点名输入框）。
4. 选中 `Player` 节点，在 Inspector 右键 → **Rename**，保持 `Player`。
5. 选中 `Player` 节点，Inspector 滚到底部 → **Script** 旁的 `<empty>` → 选 **New** → 路径填 `scripts/Player.gd` → **Create**。Godot 自动生成模板脚本并把它挂到 Player 节点上。
6. 切到 `scripts/Player.gd`，把内容**整个替换**为 9.3 里的 `Player.gd` 代码（`@export var speed` + `_physics_process`）。
7. 回到 Scene Dock，**右键 Player → Add Child Node** → 搜 `Sprite2D` → Create。把子节点重命名为 `Sprite`。
8. 选中 `Sprite`，Inspector 找到 `Texture` → 拖入 FileSystem 里的 `icon.svg`。
9. **FileSystem** 面板根目录右键 → **Save**（或 `Ctrl+S`）→ 命名 `Player.tscn` → 保存到项目根。

**为什么根节点是 CharacterBody2D 而不是 Node2D？** 因为 `move_and_slide()` 是 `CharacterBody2D` / `CharacterBody3D` 专属 API——它会处理"撞墙自动停下"等物理交互。`Node2D` 没有这个方法，调用会报 `Invalid call. Nonexistent function 'move_and_slide' in base 'Node2D'`。

#### 9.5.3 创建 `Bullet.tscn`

1. Scene Dock 顶部 **+** → New Scene。
2. 搜 `Area2D` → Create → 根节点改名 `Bullet`。
3. 选中 `Bullet` → Inspector → Script → New → 路径 `scripts/Bullet.gd` → Create。
4. 把脚本内容替换为 9.3 里的 `Bullet.gd`（`@export var speed` + `_physics_process` + `queue_free`）。
5. 右键 `Bullet` → Add Child Node → 搜 `Sprite2D` → Create → 改名 `Sprite`。
6. 选中 `Sprite` → Inspector → Texture 拖入 `icon.svg`。
7. Inspector 里展开 `Transform` → `Scale` 改成 `(0.3, 0.3)`（子弹比玩家小）。
8. **Ctrl + S** → 命名 `Bullet.tscn` → 保存。

**为什么是 Area2D 而不是 CharacterBody2D？** Area2D **不参与碰撞阻挡**——子弹不会把玩家"推开"。但它能检测 `body_entered` / `area_entered` 信号（第 06 章会演示）。如果用 CharacterBody2D，子弹会把玩家撞飞。

#### 9.5.4 创建 `Main.tscn`

1. Scene Dock 顶部 **+** → New Scene。
2. 搜 `Node2D` → Create → 改名 `Main`。
3. 选中 `Main` → Inspector → Script → New → 路径 `scripts/Main.gd` → Create。
4. 脚本内容替换为 9.3 里的 `Main.gd`（含 `bullet_scene` 的 `@export` + preload 兜底 + `_process`）。
5. 右键 `Main` → Add Child Node → 搜 `Node2D` → Create → 改名 `BulletContainer`。
6. **把 `Player.tscn` 从 FileSystem 拖到 Scene Dock 的 `Main` 节点上**——会出现一个叫 `Player` 的子节点，**带折叠图标**，节点类型显示 `CharacterBody2D`。选中它，Inspector 里把 Position 改成 `(640, 500)`。
7. **Ctrl + S** → 命名 `Main.tscn` → 保存。

**第 6 步是"实例化"**——你拖的不是节点，是 `.tscn` 文件。Scene Dock 里 `Player` 节点旁边的小箭头图标，表示它"折叠"了内部结构（Sprite 子节点被隐藏）。**双击**那个 `Player` 节点可以临时"进入子场景"编辑；**不要保存**子场景改动的画面回到父场景会自动还原。

#### 9.5.5 配置输入映射

`Main.gd` 用了 `ui_accept`（空格/回车）、`Player.gd` 用了 `ui_left` / `ui_right`——这些是 Godot **Project Settings → Input Map 里预定义的内置动作**，**默认就映射到键盘方向键 + Space/Enter**，4.3+ 不需要任何额外配置就能用。

如果你想验证或改键：

1. **Project → Project Settings** → 顶部 tab 切到 **Input Map**。
2. 左侧动作列表搜 `ui_accept` / `ui_left` / `ui_right`。
3. 选中后右侧能看到默认按键，要改键就点 **▶ Key** 然后按目标键。

> **进阶坑**：Godot 把"ui_*" 系列动作保留给 UI（菜单、按钮）。**你自己游戏的"跳跃 / 攻击 / 翻滚"应该走 Project Settings → Input Map 自定义动作**（比如 `jump` / `fire`）——这样不会和 UI 输入混淆。第 06 章会演示。

#### 9.5.6 把 Main.tscn 设为入口场景

回到 **Project → Project Settings** → `Application/Run/Main Scene` → 选 `res://Main.tscn` → 关掉 Project Settings。这一步是**写回 `project.godot`** 的，你可以打开 `project.godot` 看到 `[application]` 段多了 `run/main_scene="res://Main.tscn"`。

#### 9.5.7 跑起来 & 自检

1. Scene Dock 里点 `Main` 节点选中 → 顶部工具栏 **▶ Play** 按钮（或 **F5**）。
2. 第一次按 F5 会弹 "Select a main scene" 对话框——选 `Main.tscn`。
3. 弹窗里勾上 **Set as Main Scene** → OK。
4. 窗口应该出现：底部一个白色圆球方块（玩家），按 **← →** 左右移动，按 **Space** 持续发射子弹（每 0.2 秒一发）。子弹会从玩家位置向上飞 40 像素，然后一直向上直到飞出屏幕顶部自动消失。

如果不对，按下面的清单排查：

| 现象 | 排查点 |
| --- | --- |
| 玩家按方向键不动 | Project Settings → Input Map 搜 `ui_left` / `ui_right` 是否还在；Player.gd 是否挂在 Player 节点（Inspector 里 Script 字段不是空） |
| 按空格不发射 | Main.gd 是否挂在 Main 节点（不是挂在 Player）；Player 是否已实例化进 Main（Scene Dock 里看 Player 节点类型是 CharacterBody2D 不是 Node2D） |
| 子弹没贴图 | Sprite 的 Texture 字段是否拖入 icon.svg；Bullet.tscn 里 Sprite 节点存在 |
| 子弹不消失 | Bullet.gd 是不是写在 `_physics_process` 里写了出界判断；窗口可能太小看不到出界（窗口高度 720，玩家在 500，子弹向上飞 40 像素起手，理论 1 秒多就到顶） |
| 按 F5 弹"Script Error" | 看 Output 面板第一行报错信息；最常见是缩进不一致（Tab vs 空格），全选脚本用 Editor → Convert Indent to Tabs 统一 |

#### 9.5.8 跑通后建议做的实验（验证本章所有概念）

1. **生命周期**：在 Main.gd / Player.gd / Bullet.gd 各自加 `_enter_tree()` / `_ready()` / `_exit_tree()`，里面 `print("X in _Y")`。F5 跑看 Output 面板——你会看到打印顺序是 **Player._enter_tree → Player._ready → Main._enter_tree → Main._ready**（子先 ready，父最后），每次发射子弹多两条 `Bullet._enter_tree → Bullet._ready`，每次子弹出界多一条 `Bullet._exit_tree`。
2. **实例化覆写**：选中 `Main.tscn` 里的 `Player` 实例节点 → Inspector 把 `Speed` 从 320 改成 800 → 字段变**橙色**（表示被父场景覆写）→ F5 跑，玩家变快。回到 `Player.tscn` 改 `speed = 1000` 并保存，回到 `Main.tscn` 看 `Player` 节点的 `Speed` 仍是 800——**覆写优先**。
3. **继承场景（Inherited Scene）**：FileSystem 里右键 `Player.tscn` → **New Inherited Scene** → 命名 `PlayerFast.tscn` → 把脚本里 `speed = 320.0` 改成 `800.0`。回到 `Main.tscn`，删掉原来 `Player` 实例，从 FileSystem 拖 `PlayerFast.tscn` 进去——`PlayerFast.tscn` 内部已经把速度改成 800，但**结构完全继承自 Player.tscn**（你不用重做 Sprite2D 子节点）。
4. **销毁顺序**：在 Bullet.gd 的 `_ready()` 里 `print("Bullet ready @ ", global_position)`，F5 跑狂按空格——Output 面板会看到 bullet 飞出去、Y 坐标变小、最后 print 不再出现（因为 `queue_free` 在帧末才执行，print 已经被删掉了）。改成在 `_exit_tree()` 里 print 就能看到了。
5. **运行期调试**：F5 跑起来后，切到编辑器底部的 **Remote** 标签——你能看到运行时整棵 SceneTree，所有 bullet 实例都在 `Main/BulletContainer` 下，按发射顺序编号。点 bullet 节点 → Inspector 实时显示 position.y 一路变小。

完成上述任意一个实验，你对「场景 = 子树 / 实例化 = 嵌入 / 继承 = 覆写层 / 生命周期 = _enter_tree → _ready → _exit_tree」这 4 个概念就有了**手感**——这正是这一章要建立的核心认知。

---

## 10. 易错清单

| 现象 | 原因 |
| --- | --- |
| `@onready var x = $Foo` 报 null | `$Foo` 是相对当前节点的；父场景里 `$Foo` 找不到子场景的节点 |
| 子场景里改完代码，父场景里还是旧逻辑 | 父场景有"覆盖层"；关掉实例化的覆盖或重新实例化 |
| `_ready` 里访问 `get_tree().current_scene` 拿到 null | 主场景的根还没 _ready；用 `_enter_tree` 替代 |
| `_process` 里调 `move_and_slide()` 偶尔穿墙 | 物理频率与渲染频率不一致；改 `_physics_process` |
| 节点释放后访问 `queue_free` 后的对象 | 用 `is_instance_valid()` 检查 |

---

## 11. 章节小结

- **节点（Node）**：内存里的对象，有类型、父子、生命周期
- **场景（Scene）**：磁盘上的 `.tscn` = 一棵子树
- **实例（Instance）**：运行时父场景里嵌入的子场景（共享子场景资源）
- **继承（Inherited）**：磁盘上的新 `.tscn`，是父场景的覆写层（共享父场景修改）
- **`@export`**：把值 / 节点引用 / 资源暴露到 Inspector，避免硬编码
- **生命周期**：`_init` → `_enter_tree` → `_ready` → `_process` / `_physics_process` → `_exit_tree`
- **物理 vs 渲染**：物理相关用 `_physics_process`，视觉相关用 `_process`

下一章 [03 · 2D 与 3D：选型与关键区别](./03-2d-vs-3d.md) 我们会讲 CanvasItem vs Node3D、Camera2D vs Camera3D、Z 索引 vs 深度缓冲——读完之后你会知道为什么 Godot 把 2D 和 3D 拆成两套独立的节点体系。

---

## 📷 本章截图清单

| 文件名 | 内容 | 截屏步骤 |
| --- | --- | --- |
| `02-01-scene-tree.png` | 一个 4~5 层深度的复杂场景树 | 打开 demo，红框标注 `$` vs `%` 区别 |
| `02-02-scenetree-runtime.png` | Debugger → Remote 的运行时 SceneTree | F5 运行后切到 Debugger 面板截图 |
| `02-03-instance.png` | 把 Bullet.tscn 拖入 Main.tscn 后的 Scene Dock | 演示实例化节点的折叠图标 |
| `02-04-inherit.png` | 在 Enemy.tscn 上 New Inherited Scene | 演示继承场景的标题栏 `[Inherited from ...]` |
| `02-05-inspector-export.png` | Inspector 里的 `@export` 字段与节点绑定 | 选中 Main.gd 所在节点，把 Sprite 拖到 `@export var body` 字段上 |
| `02-06-demo-running.png` | demo 运行中：玩家 + 子弹 | F5 运行后截图 |
