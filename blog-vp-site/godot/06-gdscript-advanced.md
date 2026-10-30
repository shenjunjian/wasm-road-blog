# 06 · GDScript 进阶、信号与运行时 API

> 配套 demo：[`godot-demo/06-gdscript-advanced/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/godot-demo/06-gdscript-advanced/)
>
> 截图清单见文末。

第 05 章你把 GDScript 的语法过了一遍——这一章讲**用它写 Godot 游戏**时的"实战层"：静态类型深度、`@` 注解全集、信号系统（Godot 解耦的核心）、节点查询、autoload 单例、场景切换、资源异步加载、运行时 API 全清单。这一章读完你才算"会用 GDScript 写 Godot 项目"。

---

## 1. 静态类型深度

第 05 章只讲了 `: int` 这种基本注解。这一节讲静态类型对**编辑器、补全、运行时性能**的影响，以及"什么时候必须写类型"。

### 1.1 静态类型能换来什么

| 收益 | 例子 |
| --- | --- |
| **编辑器补全** | `player.` 列出 `CharacterBody2D` 全部方法 |
| **编译期错误** | `player.play_animation("x")` 而 `CharacterBody2D` 没有此方法 → 红波浪线 |
| **运行时更快** | 静态类型的方法调用比 Variant 调用快 **2~5 倍**（GDScript JIT/字节码） |
| **重构友好** | 改了 `Player` 的方法签名，所有调用点都高亮报错 |

```gdscript
# 静态类型：变量声明 + 参数 + 返回值
func take_damage(amount: int, source: Node2D) -> void:
    hp -= amount
    print("hit by ", source.name)
```

### 1.2 类型推断的"陷阱"

```gdscript
var x := get_node("Foo")    # 推断为 Node（基类）—— 不是子类！
x.method_only_in_sprite()   # ❌ 编译报错：Node 没有此方法

# 必须显式注解
var sprite: Sprite2D = get_node("Foo")
sprite.method_only_in_sprite()  # ✅
```

**经验法则**：

- `@export` / `@onready` / 函数参数 / 返回值：必须显式类型
- 局部临时变量：可以用 `:=`
- 调用链返回值：必须显式类型，否则 IDE 推断为基类

### 1.3 `Variant` 与动态类型

```gdscript
# 完全动态（不推荐）
var dyn = some_func()
dyn.anything()       # 运行时才报错

# 静态类型（推荐）
var concrete: ConcreteType = some_func()
concrete.specific()  # 编译期检查
```

**什么时候必须用动态类型**：

```gdscript
# 1. JSON / 字典解构（类型未知）
var data = JSON.parse_string(raw_text)  # → Variant
var name: String = data["name"]         # 显式注解取值

# 2. 反射调用（方法名是变量）
var method_name := "play"
self.call(method_name)                  # call() 接受 Variant

# 3. 通用工具类（不知道子类）
func find_by_name(n: String) -> Node:   # 返回基类
    return root.find_child(n, true, false)
```

### 1.4 类型擦除与 `as`

```gdscript
var node: Node = $Foo
if node is CharacterBody2D:
    # is 检查后，编译器自动收窄类型
    node.move_and_slide()         # OK

# 强制类型转换
var sprite := $Foo as Sprite2D    # 不匹配会返回 null

# @warning_ignore
@warning_ignore("unsafe_cast") var x := y as int
```

### 1.5 内置类型速查

```gdscript
# 基础
bool, int, float, String, StringName
Array[T], Dictionary[K, V]
PackedByteArray, PackedInt32Array, PackedFloat32Array,
PackedStringArray, PackedVector2Array, PackedVector3Array, PackedColorArray

# 数学
Vector2, Vector2i, Vector3, Vector3i, Vector4, Vector4i
Rect2, Rect2i, Transform2D, Transform3D, Quaternion, AABB, Plane, Basis

# 引擎类型（也是类型，可作参数 / 返回值）
Node, Node2D, Node3D, Control, Resource, RefCounted, Object
Signal, Callable, NodePath, RID
Color, FontFile, Texture2D, AudioStream, PackedScene

# Void / 空
void    # 无返回值
Variant # 任意类型（默认动态类型）
null    # 唯一 null 类型
```

---

## 2. `@` 注解全集

Godot 的注解以 `@` 开头，告诉编辑器 / 编译器**额外信息**。第 02 章见过 `@export`、第 04 章见过 `@onready`。这一节系统过全部常用注解。

### 2.1 `@export` 系列

```gdscript
# 1. 基本：暴露变量到 Inspector
@export var hp: int = 100

# 2. 类型化变体（编辑器显示对应 UI）
@export_enum("Fire", "Ice", "Lightning") var element: String = "Fire"
@export_enum("Fire", "Ice", "Lightning", "None") var element2: String = "None"  # 可以有 "None"

# 3. 范围（数值带滑块）
@export_range(0.0, 100.0, 0.1) var speed: float = 50.0
@export_range(0, 100, 1, "or_greater") var level: int = 1   # 可超出上限
@export_range(0, 100, 1, "or_less", "suffix:kg") var weight: int

# 4. 文件路径
@export_file("*.tscn") var scene_path: String
@export_file("*.png", "*.jpg", "*.svg") var icon_path: String
@export_file("*.tscn", "*.scn") var level_path: String
@export_global_file("*.json") var abs_path: String   # 允许 res:// 之外的绝对路径

# 5. 节点引用（拖拽绑定）
@export var node_ref: Node2D                       # 任意 Node2D 子类
@export var sprite: Sprite2D                       # 必须 Sprite2D

# 6. 资源引用
@export var texture: Texture2D                      # 任意贴图
@export var material: Material                      # 任意材质
@export var bullet_scene: PackedScene               # 任意场景

# 7. 位掩码（多选）
@export_flags("Fire:1", "Ice:2", "Lightning:4", "Earth:8") var elements: int = 0

# 8. 颜色
@export var color: Color = Color.WHITE

# 9. 分组 / 子分组
@export_group("Combat")
@export var hp: int = 100
@export var atk: int = 10
@export_group("Movement")
@export var speed: float = 200.0
@export var jump_height: float = 100.0

@export_subgroup("Advanced Movement")
@export var air_control: float = 0.5

# 10. 属性提示
@export_node_path("Sprite2D", "AnimatedSprite2D") var sprite_path: NodePath
@export_multiline var description: String           # 多行文本框

# 11. 数组 / 字典
@export var items: Array[Texture2D]                 # 数组
@export var stats: Dictionary[String, int]          # 字典
```

### 2.2 `@onready`

```gdscript
# 两种写法等价
@onready var sprite := $Sprite2D
@onready var sprite: Sprite2D = $Sprite2D

# 等价于
var sprite
func _ready() -> void:
    sprite = $Sprite2D
```

### 2.3 `@rpc`：多人游戏远程调用

```gdscript
# 配置 RPC 模式
@rpc("any_peer", "call_remote", "reliable", 0)
func damage(target_id: int, amount: int) -> void:
    var target := get_node_by_id(target_id)
    if target and target.has_method("apply_damage"):
        target.apply_damage(amount)

# 调用
damage.rpc(player_id, 10)              # 所有人调用（包括自己）
damage.rpc_id(peer_id, player_id, 10) # 仅发给特定 peer
```

| 模式 | 含义 |
| --- | --- |
| `any_peer` / `authority` | 谁能调用（任意人 vs 仅服务器） |
| `call_local` / `call_remote` | 本地是否也跑 |
| `reliable` / `unreliable` / `unreliable_ordered` | 传输保证 |
| 数字 | 信道（0 ~ 9，最多 9 个信道） |

> 本系列不深入 RPC，多人游戏是大坑，要专门一章。

### 2.4 `@tool`

```gdscript
@tool
extends Node2D

# 这个脚本在编辑器里也跑！
# 用途：自定义编辑器预览、关卡编辑器、Inspector 插件
func _process(delta: float) -> void:
    if Engine.is_editor_hint():
        # 编辑器内的代码
        queue_redraw()
    else:
        # 运行时的代码
        ...
```

### 2.5 `@warning_ignore`

```gdscript
@warning_ignore("unused_variable", "shadowed_variable")
var x := 1
```

### 2.6 `@icon`

```gdscript
@icon("res://icons/player.png")
extends CharacterBody2D
# Scene Dock 里这个节点会显示自定义图标
```

---

## 3. 信号（Signal）：Godot 的解耦核心

信号是 Godot 最重要的通信机制——**节点 A 不知道谁会响应，只发信号；节点 B/C/D 各自监听**。比直接调用松耦合，比观察者模式简单。

### 3.1 信号声明

```gdscript
extends Node

# 1. 无参数信号
signal died

# 2. 带参数信号
signal hp_changed(new_hp: int, max_hp: int)

# 3. 默认值参数（4.x）
signal equipped(item_id: String, slot: String = "weapon")
```

> 截图占位：`<img src="/godot/06-01-signal-panel.png" />`（Inspector → Node → Signals Tab → 看到所有声明的信号 + Connect 按钮）

### 3.2 信号发射 `emit_signal` / 直接调用

```gdscript
@export var hp: int = 100

func take_damage(amount: int) -> void:
    hp -= amount
    if hp <= 0:
        died.emit()                 # 4.x 推荐写法
        # 等价于 emit_signal("died")
```

### 3.3 信号连接：`connect()`

```gdscript
# 在脚本里连接
func _ready() -> void:
    $Player.died.connect(_on_player_died)
    $Player.hp_changed.connect(_on_hp_changed)

func _on_player_died() -> void:
    print("player died!")

func _on_hp_changed(new_hp: int, max_hp: int) -> void:
    $UI/HealthBar.value = float(new_hp) / float(max_hp)
```

**4.x 的 connect API**（不再用 Godot 3 的字符串方法名）：

```gdscript
# 方式 1：Callable
target.signal.connect(self.method)        # 方法引用
target.signal.connect(func(x): print(x)) # lambda

# 方式 2：连接到别的节点的某个方法
$Player.hp_changed.connect($UI.set_hp)   # $UI 实现了 set_hp(hp, max_hp)

# 方式 3：编辑器里连（不需要写代码）
# Inspector → Signals → 双击信号 → 选目标节点 + 方法
```

**断开连接**：

```gdscript
target.signal.disconnect(self.method)
# 或
target.signal.disconnect(callable)
```

### 3.4 信号作为 first-class 值

```gdscript
# 信号本身是 Signal 对象
var sig: Signal = $Player.died
print(sig.get_name())          # "died"
sig.connect(_on_died)

# 信号可以 await
func _ready() -> void:
    print("waiting for player to die...")
    await $Player.died
    print("player died! game over")
    get_tree().quit()

# 等待超时
await get_tree().create_timer(5.0).timeout
```

### 3.5 完整 demo 场景

```text
Player (CharacterBody2D)              ← 发射 hp_changed / died
UI (CanvasLayer)
├── HealthBar (ProgressBar)           ← 监听 hp_changed
└── GameOverLabel (Label)             ← 监听 died
```

```gdscript
# Player.gd
extends CharacterBody2D
signal hp_changed(new_hp: int, max_hp: int)
signal died

@export var hp: int = 100
@export var max_hp: int = 100

func take_damage(amount: int) -> void:
    hp = max(0, hp - amount)
    hp_changed.emit(hp, max_hp)
    if hp == 0:
        died.emit()
```

```gdscript
# UI/HealthBar.gd
extends ProgressBar
@export var player: CharacterBody2D

func _ready() -> void:
    player.hp_changed.connect(_on_hp_changed)

func _on_hp_changed(new_hp: int, max_hp: int) -> void:
    value = float(new_hp) / float(max_hp) * 100.0
```

```gdscript
# UI/GameOverLabel.gd
extends Label
@export var player: CharacterBody2D

func _ready() -> void:
    player.died.connect(_on_died)
    visible = false

func _on_died() -> void:
    visible = true
```

> 关键观察：UI 不知道自己挂在哪、不需要查询 Player 的位置——Player 把信号发出来，谁连谁响应。`HealthBar` 和 `GameOverLabel` 互不依赖。

---

## 4. 节点查询：从场景树里找节点

### 4.1 `get_node` 与 `$`

```gdscript
# 等价写法
var node1 = get_node("Sprite2D")
var node2 = $Sprite2D
var node3 = get_node(^"Sprite2D")      # ^ 表示 StringName（4.x 推荐）

# 嵌套路径
var bullet = $Player/Bullet
var hp_bar = $UI/HealthBar

# 用变量拼路径
var i := 1
var e := get_node("Enemy%d" % i)
```

### 4.2 `%` 唯一名

```gdscript
# 假设 Player 节点在 Scene Dock 标记了 "Access as Unique Name"
var p = %Player    # 不管它在树里多深，都直接拿到
```

**使用方法**：Scene Dock 里右键节点 → **Access as Unique Name**。节点图标会带个 `%` 标记。

### 4.3 节点查询工具方法

```gdscript
# 父节点
get_parent()                # 直接父
get_parent().get_parent()   # 祖父

# 找子节点
get_node("Path")            # 相对路径，找不到抛错
get_node_or_null("Path")    # 相对路径，找不到返回 null
find_child("Name", true, false)  # 递归找（包含已删除的 = false）

# 按类型 / 名查
get_children()                          # 所有直接子节点（Array[Node]）
get_children_of_type(Sprite2D)          # 4.x：按类型过滤
get_tree().get_nodes_in_group("enemies") # 4.x：按组查

# 当前场景根
get_tree().current_scene
```

### 4.4 `NodePath` vs 字符串

```gdscript
# NodePath 比字符串效率高（内部用 ID 而非字符串解析）
var path := NodePath("Player/Sprite2D")
var node = get_node(path)

# 4.x 推荐用 StringName（^ 前缀）
var name: StringName = ^"Player"
var node2 = get_node(name)
```

### 4.5 遍历子节点

```gdscript
func _ready() -> void:
    for child in get_children():
        if child is Sprite2D:
            child.modulate = Color.RED
        elif child is Button:
            child.disabled = true

    # 反向遍历（允许删元素）
    for i in range(get_child_count() - 1, -1, -1):
        var c := get_child(i)
        if c is Node2D and c.position.y > 1000:
            c.queue_free()
```

### 4.6 组（Group）

```gdscript
# 添加到组
$Enemy1.add_to_group("enemies")
$Enemy2.add_to_group("enemies")

# 按组查
for e in get_tree().get_nodes_in_group("enemies"):
    e.take_damage(10)

# 触发组回调（4.x 新增）
get_tree().call_group("enemies", "take_damage", 10)
```

> **场景文件里批量加组**：节点 Inspector → Node → Groups → Add。

---

## 5. Autoload 单例：跨场景的全局对象

> 截图占位：`<img src="/godot/06-02-autoload.png" />`（Project Settings → AutoLoad 标签）

**问题**：你想让玩家血量、背包数据、全局管理器在切换场景时**不消失**，但它们不属于任何场景的子节点。

**方案**：Autoload——一个挂脚本的 Node，启动时自动加载到 `SceneTree.root`，名字是注册时设定的全局名。

### 5.1 配置 Autoload

1. `Project → Project Settings → AutoLoad`
2. Path 选 `res://scripts/GameState.gd`
3. Node Name 填 `GameState`（这个名字将作为**全局访问名**）
4. Enable ✅

之后任何脚本都能：

```gdscript
GameState.hp = 100         # 直接访问
GameState.add_item("potion")
```

### 5.2 写一个 Autoload 脚本

```gdscript
# res://scripts/GameState.gd
extends Node

signal score_changed(new_score: int)
signal game_paused(paused: bool)

var score: int = 0:
    set(value):
        score = value
        score_changed.emit(score)
    get:
        return score

var is_paused: bool = false


func _ready() -> void:
    print("GameState initialized")
    process_mode = Node.PROCESS_MODE_ALWAYS   # 即使暂停也跑


func toggle_pause() -> void:
    is_paused = not is_paused
    get_tree().paused = is_paused
    game_paused.emit(is_paused)


func reset() -> void:
    score = 0
```

### 5.3 Autoload 的使用场景

| 场景 | 用 Autoload |
| --- | --- |
| 全局游戏状态（分数、关卡 ID、玩家存档） | ✅ |
| 单例管理器（AudioManager、InputManager） | ✅ |
| 跨场景共享数据 | ✅ |
| 仅属于某个场景的状态 | ❌ 用场景自身 |

### 5.4 Autoload 与静态变量的区别

```gdscript
# Autoload：节点，可以挂信号、用 _process、监听场景切换
# 推荐用于有行为的全局对象

# 静态变量：纯数据，不能发信号、不能 _process
class_name MathUtil
static var PI := 3.14159   # 推荐用于纯工具类
```

---

## 6. 场景切换

### 6.1 基本切换

```gdscript
# 立即切换
get_tree().change_scene_to_file("res://scenes/Level2.tscn")

# 用 PackedScene（推荐，避免每帧重新加载文件）
var level := preload("res://scenes/Level2.tscn")
get_tree().change_scene_to_packed(level)
```

### 6.2 切换会发生什么

```text
切场景前：
1. 当前主场景的所有节点 _exit_tree() 被依次调用
2. 当前主场景被释放（引用计数 → 0）

切场景后：
1. 新场景的 .tscn 反序列化
2. 新节点的 _enter_tree() → _ready() 被依次调用
3. autoload 节点不受影响（一直挂在 SceneTree.root）
```

### 6.3 切换时传递数据

```gdscript
# 方案 A：存到 autoload
GameState.player_hp = 50
get_tree().change_scene_to_file("res://Level2.tscn")

# 方案 B：利用 singleton 的字典
GameState.transition_data = {"from": "Level1", "score": 100}

# 方案 C：用 ChangeSceneWithArgs（4.x）
get_tree().change_scene_to_packed(level, {"hp": 50})
```

### 6.4 退出游戏

```gdscript
get_tree().quit()                       # 退出游戏
get_tree().quit(0)                      # 退出码 0
```

---

## 7. 资源加载：同步 vs 异步

### 7.1 同步加载

```gdscript
# preload：在脚本编译时就加载（推荐给关键资源）
const Bullet := preload("res://scenes/Bullet.tscn")

# load：运行时加载（适合按需加载）
var tex := load("res://textures/foo.png")
```

**区别**：

| 维度 | `preload` | `load` |
| --- | --- | --- |
| 触发时机 | 脚本编译时 | 运行时 |
| 失败 | 编译报错 | 运行时崩溃 |
| 用法 | `const X := preload(...)` | `var x := load(...)` |

### 7.2 异步加载（不卡顿）

加载大场景时会卡几秒到几十秒——必须异步。

```gdscript
# 4.x 推荐：ResourceLoader.load_threaded_request
func _async_load_scene(path: String) -> void:
    var err := ResourceLoader.load_threaded_request(path)
    if err != OK:
        push_error("failed to start loading: ", path)
        return

    _poll_load(path)


func _poll_load(path: String) -> void:
    while true:
        var progress := []
        var status := ResourceLoader.load_threaded_get_status(path, progress)
        match status:
            ResourceLoader.THREAD_LOAD_IN_PROGRESS:
                print("loading: ", progress[0] * 100, "%")
                await get_tree().process_frame    # 每帧检查一次
            ResourceLoader.THREAD_LOAD_LOADED:
                var packed := ResourceLoader.load_threaded_get(path)
                _on_loaded(packed)
                return
            _:
                push_error("loading failed: ", path)
                return


func _on_loaded(packed: PackedScene) -> void:
    var scene := packed.instantiate()
    add_child(scene)
```

### 7.3 用进度条做加载界面

```gdscript
# LoadingScreen.gd
extends Control

@export var progress_bar: ProgressBar
@export var next_scene_path: String

func _ready() -> void:
    _async_load(next_scene_path)


func _async_load(path: String) -> void:
    ResourceLoader.load_threaded_request(path)
    var done := false
    while not done:
        var progress := []
        var status := ResourceLoader.load_threaded_get_status(path, progress)
        if status == ResourceLoader.THREAD_LOAD_IN_PROGRESS:
            progress_bar.value = progress[0] * 100.0
            await get_tree().process_frame
        elif status == ResourceLoader.THREAD_LOAD_LOADED:
            progress_bar.value = 100.0
            var packed: PackedScene = ResourceLoader.load_threaded_get(path)
            get_tree().change_scene_to_packed(packed)
            done = true
        else:
            push_error("load failed")
            done = true
```

---

## 8. 常用运行时 API

### 8.1 `Input`（输入）

```gdscript
# 即时查询（每帧 _process 用）
Input.is_action_pressed("ui_left")           # 按住中
Input.is_action_just_pressed("ui_accept")    # 刚按
Input.is_action_just_released("ui_accept")   # 刚松
Input.get_axis("ui_left", "ui_right")        # 标准化轴 -1..1

# 鼠标
Input.get_last_mouse_velocity()
Input.get_mouse_button_mask()

# 添加 / 移除
InputMap.add_action("shoot", 0.1)
InputMap.action_add_event("shoot", event)
```

> 截图占位：`<img src="/godot/06-03-input-map.png" />`（Project Settings → Input Map 配置截图）

### 8.2 `Engine`

```gdscript
Engine.is_editor_hint()        # 是否在编辑器内（@tool 用）
Engine.get_frames_per_second() # 当前 FPS
Engine.get_physics_frames_per_second()
Engine.time_scale              # 时间缩放（0.5 = 慢动作）
Engine.max_fps                 # 最大 FPS
```

### 8.3 `OS`

```gdscript
OS.get_name()                  # "Windows" / "macOS" / "Linux" / "Android" / "iOS" / "Web"
OS.get_model_name()            # 设备型号（移动端用）
OS.get_screen_size()           # 屏幕像素
OS.get_window_size()           # 当前窗口
OS.get_unique_id()             # 设备唯一 ID（用于存档校验）
OS.has_feature("mobile")       # 平台特性检测
OS.alert("hi", "title")        # 原生弹窗
OS.shell_open("https://...")   # 打开浏览器
```

### 8.4 `Time`

```gdscript
Time.get_ticks_msec()          # 自启动以来的毫秒数（int64）
Time.get_ticks_usec()          # 微秒
Time.get_unix_time_from_system()
await get_tree().create_timer(1.5).timeout  # 一次性定时器
```

### 8.5 `JSON`

```gdscript
# 解析
var raw := '{"name": "Player", "hp": 100}'
var data = JSON.parse_string(raw)
print(data["name"])            # → "Player"
print(data["hp"])              # → 100（int）

# 序列化
var dict := {"hp": 100, "name": "Player"}
var text := JSON.stringify(dict)
print(text)                    # → {"hp":100,"name":"Player"}

# 美化输出
var pretty := JSON.stringify(dict, "\t")  # 用 Tab 缩进
```

### 8.6 `ResourceSaver` / `ResourceLoader`

```gdscript
# 保存 Resource 到磁盘
var data := MyResource.new()
data.value = 42
ResourceSaver.save(data, "res://data/save.tres")

# 加载（同步）
var loaded := ResourceLoader.load("res://data/save.tres")
```

### 8.7 `ProjectSettings`

```gdscript
ProjectSettings.get_setting("application/config/name")
ProjectSettings.set_setting("my/custom", 42)
```

### 8.8 调试

```gdscript
print("hello")             # 普通输出
print_rich("[color=red]hi[/color]")  # 彩色
push_warning("warn")       # 黄色警告
push_error("oops")         # 红色错误
assert(x > 0, "x must > 0")  # 断言
print_stack()              # 打印调用栈
OS.print_stack()           # 4.x 跨平台
```

---

## 9. 完整 demo：玩家受伤 → UI 响应 → 全局状态 → 切场景

demo 放在 `godot-demo/06-gdscript-advanced/`，把所有本章概念串起来：

- Autoload `GameState` 管分数 / 暂停
- `Player` 受伤发射 `hp_changed` / `died` 信号
- `UI/HealthBar` 监听信号
- `UI/GameOverLabel` 监听死亡，按 R 切回 Menu

> 截图占位：`<img src="/godot/06-04-demo-overview.png" />`（demo 运行截图：玩家方块 + 血条 + 分数 + 暂停）

### 9.1 文件清单

```
06-gdscript-advanced/
├── README.md
├── project.godot
├── autoload/
│   └── GameState.gd           # 全局单例
├── Main.tscn                  # 主场景
├── Menu.tscn                  # 简单菜单
├── Player.tscn                # 玩家
├── UI/
│   ├── HealthBar.tscn
│   └── GameOverLabel.tscn
└── scripts/
    ├── Main.gd                # 监听 R 切回菜单
    ├── Player.gd              # 受伤 + 信号
    ├── HealthBar.gd           # 监听 hp_changed
    └── GameOverLabel.gd       # 监听 died
```

### 9.2 Autoload

```gdscript
# autoload/GameState.gd
extends Node

signal score_changed(new_score: int)
signal paused_changed(paused: bool)

var score: int = 0:
    set(value):
        score = max(0, value)
        score_changed.emit(score)

var is_paused: bool = false:
    set(value):
        is_paused = value
        get_tree().paused = is_paused
        paused_changed.emit(is_paused)


func _ready() -> void:
    process_mode = Node.PROCESS_MODE_ALWAYS
    print("[GameState] initialized")


func reset() -> void:
    score = 0
    is_paused = false


func toggle_pause() -> void:
    is_paused = not is_paused
```

### 9.3 Player

```gdscript
# scripts/Player.gd
extends CharacterBody2D

signal hp_changed(new_hp: int, max_hp: int)
signal died

@export var hp: int = 100
@export var max_hp: int = 100
@export var speed: float = 250.0

@onready var sprite: Sprite2D = $Sprite


func _physics_process(delta: float) -> void:
    var dir := Input.get_axis("ui_left", "ui_right")
    velocity.x = dir * speed
    move_and_slide()


func take_damage(amount: int) -> void:
    hp = max(0, hp - amount)
    hp_changed.emit(hp, max_hp)
    if hp == 0:
        died.emit()


func _on_area_entered(_area: Area2D) -> void:
    # 演示用：被任意 Area 撞到就掉血
    take_damage(10)
```

### 9.4 HealthBar

```gdscript
# scripts/HealthBar.gd
extends ProgressBar

@export var player: CharacterBody2D

func _ready() -> void:
    max_value = 100
    value = 100
    player.hp_changed.connect(_on_hp_changed)


func _on_hp_changed(new_hp: int, max_hp: int) -> void:
    max_value = float(max_hp)
    value = float(new_hp)
```

### 9.5 GameOverLabel

```gdscript
# scripts/GameOverLabel.gd
extends Label

@export var player: CharacterBody2D


func _ready() -> void:
    visible = false
    text = "GAME OVER — 按 R 回菜单"
    player.died.connect(_on_died)


func _on_died() -> void:
    visible = true


func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        if (event as InputEventKey).keycode == KEY_R and visible:
            GameState.reset()
            get_tree().change_scene_to_file("res://Menu.tscn")
```

### 9.6 Main（用 Main.tscn 实例化）

```gdscript
# scripts/Main.gd
extends Node2D

@onready var player: CharacterBody2D = $Player
@onready var health_bar: ProgressBar = $UI/HealthBar
@onready var game_over_label: Label = $UI/GameOverLabel
@onready var score_label: Label = $UI/ScoreLabel


func _ready() -> void:
    # 通过 @export 拖入（也支持代码 connect）
    health_bar.player = player
    game_over_label.player = player

    GameState.score_changed.connect(_on_score_changed)


func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        var key: int = (event as InputEventKey).keycode
        match key:
            KEY_SPACE: GameState.score += 10      # 测试：按空格加分
            KEY_P:     GameState.toggle_pause()


func _on_score_changed(new_score: int) -> void:
    score_label.text = "Score: %d" % new_score
```

### 9.7 操作说明

| 按键 | 效果 |
| --- | --- |
| ← → | 移动玩家 |
| 撞到红方块 | 掉 10 HP（演示信号触发） |
| 空格 | 加 10 分（演示 Autoload + 信号） |
| P | 暂停 / 继续（演示 Autoload） |
| R | 死亡后回到菜单 |

---

## 10. 易错清单

| 现象 | 原因 |
| --- | --- |
| `signal X` 声明后编辑器没补全 | 4.x 必须用 `signal X(arg: type)` 显式参数类型 |
| `target.signal.connect(self.method)` 报 "Callable not found" | 方法未声明 / 类型对不上 |
| Autoload 名字冲突 | 项目里不能有两个同名 Autoload |
| `preload` 路径写错 | 编译时报错 "Can't preload resource" |
| `await sig` 不返回 | `sig` 不是 Signal 类型；用 `$Node.signal` |
| `change_scene_to_file` 后旧场景数据没消失 | 数据存到 Autoload 了，应该清掉 |
| 暂停时按钮还能按 | UI 节点 `process_mode` 不是 ALWAYS |
| `@export` 改了但运行没生效 | @export 改了 Inspector 但忘了保存场景 |

---

## 11. 章节小结

- **静态类型**：`: int` 注解 → 补全 / 编译检查 / 性能；`:=` 用于临时变量；用 `as` 强制转换
- **`@` 注解**：`@export_*` 系列（10+ 变体）、`@onready`、`@rpc`、`@tool`、`@warning_ignore`、`@icon`
- **信号**：声明 / `emit()` / `connect(Callable)` / `await signal` / 编辑器连接
- **节点查询**：`$` / `%` / `get_node` / `find_child` / `get_nodes_in_group`
- **Autoload**：Project Settings → AutoLoad 注册，常用于全局管理器
- **场景切换**：`change_scene_to_file` / `change_scene_to_packed`；autoload 不消失
- **资源加载**：`preload` / `load` / `load_threaded_request` + 进度条
- **运行时 API**：`Input` / `Engine` / `OS` / `Time` / `JSON` / `ResourceSaver`
- **调试**：`print` / `push_warning` / `push_error` / `assert` / Debugger 面板

下一章 [07 · 资源系统与文件系统](./07-resources.md)，我们把"数据 = 资源"这个概念系统化——`Resource` 的生命周期、内置资源类型、自定义 Resource、`.tres` / `.res` 文件、导入机制。

---

## 📷 本章截图清单

| 文件名 | 内容 | 截屏步骤 |
| --- | --- | --- |
| `06-01-signal-panel.png` | Inspector → Signals Tab | 选中带信号的节点（如 Player）截图 |
| `06-02-autoload.png` | Project Settings → AutoLoad | 截图配置好的 GameState 行 |
| `06-03-input-map.png` | Project Settings → Input Map | 截图 ui_left / ui_right 的键位 |
| `06-04-demo-overview.png` | demo 运行截图：玩家 + 血条 + 分数 + GameOver | F5 跑通 demo 截图 |
