# 04 · 节点类型全览与重要节点详解

> 配套 demo：[`godot-demo/04-node-types/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/godot-demo/04-node-types/)
>
> 截图清单见文末。

前 3 章你知道了 Godot 是"节点树"、CanvasItem 与 Node3D 是两套独立的渲染管道。这一章把所有"你会真正用到"的节点类型**按继承层级**完整遍历一遍——每个节点配「一句话定位 + 关键属性 + 最小代码片段」。读完这篇，你就有了"问题 → 该用什么节点"的快速映射表，后面写代码不再纠结。

---

## 1. 这一章的组织方式

Godot 4.x 文档列出了 400+ 个内置节点，全列毫无意义。我按**用途**分组，覆盖你日常 95% 的场景：

| 分组 | 主要类型 |
| --- | --- |
| **基础节点** | `Node`、`Node2D`、`Node3D` |
| **2D 渲染节点** | `Sprite2D` / `AnimatedSprite2D` / `Polygon2D` / `Line2D` / `MeshInstance2D` / `Label` / `TextureRect` |
| **3D 渲染节点** | `MeshInstance3D` / `Light3D` 系列 / `Camera3D` / `GPUParticles3D` / `CSGShape3D` / `Label3D` |
| **UI 节点（Control）** | `Button` / `LineEdit` / `Container` 系列 / `Panel` / `ProgressBar` |
| **物理节点** | `StaticBody*` / `RigidBody*` / `CharacterBody*` / `Area*` / `RayCast*` / `CollisionShape*` |
| **工具节点** | `Timer` / `Tween` / `AnimationPlayer` / `AnimationTree` / `AudioStreamPlayer` / `AudioStreamPlayer2D/3D` |

每个节点我会用同样的结构讲：

- **一句话定位**：它能干什么
- **继承链**：父类是谁、有什么兄弟节点
- **关键属性**：Inspector 里最常用的 3~6 个字段
- **最小示例**：5~15 行 GDScript 演示

---

## 2. 基础节点（Node 基类）

### 2.1 `Node`：所有节点的根

> 截图占位：`<img src="/godot/04-01-add-node-dialog.png" />`（编辑器顶部 + 按钮 → Create New Node → 搜索框与节点列表）

```text
RefCounted
└── Object
    └── Node                              ← 所有节点的根
        ├── CanvasItem                    ← 2D 渲染祖先
        ├── Node3D                        ← 3D 渲染祖先
        ├── Control                       ← UI 祖先
        ├── AnimationPlayer
        ├── Timer
        ├── Tween
        ├── AudioStreamPlayer
        ├── CanvasLayer
        └── …（约 60 个其他 Node 直接子类）
```

**一句话定位**：`Node` 是「只挂逻辑、不渲染、不参与变换」的纯逻辑节点。容器、autoload、定时器、状态机都基于 `Node`。

**最常用属性**：

| 属性 | 类型 | 作用 |
| --- | --- | --- |
| `name` | `StringName` | 节点名（同 Scene Dock 显示） |
| `process_mode` | `ProcessMode` | 暂停 / 跨场景行为（见第 02 章） |
| `process_priority` | `int` | `_process` 调用顺序（数值小的先调） |
| `script` | `Script` | 挂载的 GDScript / C# |

**最常用 API**：

```gdscript
func _ready() -> void:
    var t: Timer = Timer.new()
    t.wait_time = 2.0
    t.timeout.connect(_on_timeout)
    add_child(t)             # 加入场景树才会启动
    t.start()

func _on_timeout() -> void:
    print("timer fired")
```

> **注意 `add_child` 之前 Timer 不会 tick**。所有需要 `_process` / `_physics_process` / 自更新的节点，都必须先 `add_child` 才能"活起来"。

### 2.2 `Node2D` 与 `Node3D`：空间变换的入口

```text
Node
├── Node2D                  ← 2D 位置 + 旋转 + 缩放
│   ├── Sprite2D
│   ├── AnimatedSprite2D
│   ├── Polygon2D
│   ├── Line2D
│   ├── Camera2D
│   ├── CollisionObject2D
│   │   ├── Area2D
│   │   └── PhysicsBody2D
│   │       ├── StaticBody2D
│   │       ├── RigidBody2D
│   │       └── CharacterBody2D
│   └── …（约 25 个子类）
│
└── Node3D                  ← 3D 位置 + 旋转 + 缩放
    ├── MeshInstance3D
    ├── Camera3D
    ├── Light3D
    ├── CollisionObject3D
    │   ├── Area3D
    │   └── PhysicsBody3D
    │       ├── StaticBody3D
    │       ├── RigidBody3D
    │       └── CharacterBody3D
    └── …（约 20 个子类）
```

**一句话定位**：`Node2D` / `Node3D` 提供**空间变换**——位置、旋转、缩放、Z 顺序。3D 节点比 2D 多一层父子变换（local / global）。

**关键属性**：

| `Node2D` | `Node3D` |
| --- | --- |
| `position: Vector2` | `position: Vector3` |
| `rotation: float`（弧度） | `rotation: Vector3`（绕 X/Y/Z 欧拉角） |
| `scale: Vector2` | `scale: Vector3` |
| `z_index: int` | —（用 GPU depth buffer） |
| `skew: float` | — |
| `y_sort_enabled: bool` | — |
| `global_position: Vector2` | `global_position: Vector3` |
| — | `transform: Transform3D`（复合变换） |
| — | `quaternion: Quaternion` |

**最小示例**：父子变换

```gdscript
extends Node2D

@export var child: Node2D    # 拖入一个子节点

func _process(_delta: float) -> void:
    # 当前节点旋转 1 度，子节点跟着绕父的 pivot 转
    rotation += 0.01
    print("global pos of child = ", child.global_position)
```

---

## 3. 2D 渲染节点（CanvasItem 体系）

> 第 03 章讲过 CanvasItem 的 Z 排序规则。这里逐个拆常用 2D 节点。

### 3.1 `Sprite2D`：单张静态贴图

**一句话定位**：2D 场景里最常用的"贴一张图"节点。

**关键属性**：

| 属性 | 含义 |
| --- | --- |
| `texture: Texture2D` | 贴图（PNG/SVG/CompressedTexture2D） |
| `region_enabled: bool` | 是否启用 sprite sheet 子区域 |
| `region_rect: Rect2` | 子区域（在贴图上切的矩形） |
| `centered: bool` | pivot 是否在中心 |
| `offset: Vector2` | pivot 偏移 |
| `modulate: Color` | 色调（默认白 = 不变） |
| `scale: Vector2` | 缩放 |
| `flip_h: bool` / `flip_v: bool` | 水平 / 垂直翻转 |

**最小示例**：

```gdscript
extends Sprite2D

func _ready() -> void:
    modulate = Color(1.0, 0.5, 0.5)  # 变红
    flip_h = true                    # 镜像
```

### 3.2 `AnimatedSprite2D`：sprite 序列帧动画

**一句话定位**：播放 sprite 序列帧动画（适合角色 4 方向走、怪物呼吸等）。

**关键属性**：

| 属性 | 含义 |
| --- | --- |
| `sprite_frames: SpriteFrames` | 帧资源（`res://sprites/foo.tres`） |
| `animation: StringName` | 当前播放的动画名（默认 `"default"`） |
| `frame: int` | 当前帧索引 |
| `frame_progress: float` | 当前帧进度 0..1 |
| `playing: bool` | 是否在播放 |
| `speed_scale: float` | 倍速（默认 1.0） |

**最小示例**：

```gdscript
extends AnimatedSprite2D

func _ready() -> void:
    play("run")        # 播放名为 "run" 的动画
    animation_finished.connect(_on_animation_finished)

func _on_animation_finished() -> void:
    play("idle")
```

> `SpriteFrames` 资源通过 FileSystem → 右键 Create New → Resource → SpriteFrames 创建，再拖到节点上。

### 3.3 `Polygon2D`：多边形渲染

**一句话定位**：从顶点数组构造 2D 多边形（适合不规则形状、地形、敌人攻击判定可视化）。

**关键属性**：

| 属性 | 含义 |
| --- | --- |
| `polygon: PackedVector2Array` | 顶点坐标 |
| `uv: PackedVector2Array` | UV 映射（与顶点等长） |
| `color: Color` | 填充色 |
| `texture: Texture2D` | 可选贴图 |
| `texture_rotation: float` | 贴图旋转 |

**最小示例**：

```gdscript
extends Polygon2D

func _ready() -> void:
    polygon = PackedVector2Array([
        Vector2(-50, -50),
        Vector2(50, -50),
        Vector2(50, 50),
        Vector2(-50, 50),
    ])
```

### 3.4 `Line2D`：2D 线段

**一句话定位**：画连续线段（轨迹、画笔、瞄准线）。

**关键属性**：

| 属性 | 含义 |
| --- | --- |
| `points: PackedVector2Array` | 线段顶点 |
| `width: float` | 线宽 |
| `default_color: Color` | 颜色 |
| `joint_mode: Line2DJointMode` | 拐角处理（圆角 / 斜接 / 斜切） |

**最小示例**：

```gdscript
extends Line2D

func _ready() -> void:
    points = PackedVector2Array([
        Vector2(0, 0),
        Vector2(100, 50),
        Vector2(200, 0),
    ])
    width = 4.0
    default_color = Color.RED
```

### 3.5 `MeshInstance2D`：在 2D 里显示 3D mesh

**一句话定位**：把 3D 网格作为单个面渲染到 2D 场景（适合伪 3D 角色头像、2D 光照演示）。

**关键属性**：`mesh: Mesh`、`texture: Texture2D`、`modulate: Color`。

### 3.6 `Label` / `TextureRect`：最常用的 2D 显示

**`Label`**：文字

| 关键属性 | 含义 |
| --- | --- |
| `text: String` | 文本内容 |
| `horizontal_alignment: HorizontalAlignment` | 左/中/右 |
| `autowrap_mode: TextServer.AutowrapMode` | 自动换行 |
| `theme: Theme` | 主题（字体、颜色） |

**`TextureRect`**：贴图矩形

| 关键属性 | 含义 |
| --- | --- |
| `texture: Texture2D` | 贴图 |
| `expand_mode: TextureRect.ExpandMode` | 拉伸 / 平铺 / 适应 |
| `stretch_margin_left/right/top/bottom: int` | 9-patch 边距 |

---

## 4. UI 节点（Control 体系）

> 第 12 章会展开讲，这里只列清单。

```text
Control                           ← 所有 UI 节点基类
├── Container                     ← 自动布局容器
│   ├── BoxContainer              ← VBox/HBoxContainer
│   │   ├── VBoxContainer
│   │   └── HBoxContainer
│   ├── GridContainer
│   ├── FlowContainer
│   ├── MarginContainer
│   ├── CenterContainer
│   └── PanelContainer
├── Button
│   ├── CheckButton
│   ├── CheckBox
│   ├── RadioButton
│   ├── MenuButton
│   ├── OptionButton
│   └── TextureButton
├── Label
├── LineEdit
├── TextEdit
├── ProgressBar
├── Slider
│   └── HSlider / VSlider
├── TextureRect
├── Panel
├── TabBar / TabContainer
├── ScrollContainer
├── Tree
└── ItemList
```

**Control 的关键概念**：**锚点（Anchor）+ 边距（Offset）**——决定节点相对父容器的位置与拉伸方式。第 12 章会单独拆。

### 4.1 `Button`：最常用的交互控件

```gdscript
extends Button

func _ready() -> void:
    text = "Start Game"
    pressed.connect(_on_pressed)

func _on_pressed() -> void:
    print("button pressed")
```

### 4.2 `Container` 系列：自动布局

**`VBoxContainer`**：垂直堆叠子节点
**`HBoxContainer`**：水平排列子节点
**`GridContainer`**：网格排列（每行列数固定）
**`MarginContainer`**：给所有子节点加外边距
**`CenterContainer`**：居中子节点

```text
VBoxContainer
├── Label "Username:"
├── LineEdit
├── Label "Password:"
├── LineEdit
└── Button "Login"
```

> Container 的精髓是**子节点的 `size_flags_*` 属性**——决定子节点在容器里能否拉伸 / 填满剩余空间。

---

## 5. 3D 渲染节点（Node3D 体系）

> 第 03 章讲过 3D 节点的渲染管线，这里列常用节点。

### 5.1 `MeshInstance3D`：3D 模型

**一句话定位**：显示一个 3D 网格（球、立方体、外部模型）。

**关键属性**：

| 属性 | 含义 |
| --- | --- |
| `mesh: Mesh` | 网格（`BoxMesh` / `SphereMesh` / `ArrayMesh` / 导入的 glTF） |
| `surface_material_override/0: Material` | 覆盖第 0 个 surface 的材质（最高优先级） |
| `material_override: Material` | 覆盖所有 surface 的材质 |
| `visible: bool` | 是否可见 |
| `cast_shadow: ShadowCastingSetting` | 投影模式（on / off / shadows only / double_sided） |
| `gi_mode: GIMode` | 全局光照参与度（动态 / 静态 / 禁用） |

**最小示例**：

```gdscript
extends MeshInstance3D

func _ready() -> void:
    mesh = SphereMesh.new()
    mesh.radius = 1.0
    mesh.height = 2.0
```

### 5.2 `Light3D` 系列：3D 光源

`DirectionalLight3D`（平行光/太阳光）：

| 属性 | 含义 |
| --- | --- |
| `light_energy: float` | 强度 |
| `light_color: Color` | 颜色 |
| `shadow_enabled: bool` | 是否投影 |
| `directional_shadow_max_distance: float` | 阴影最大距离 |

`OmniLight3D`（点光源）、`SpotLight3D`（聚光灯）—— 都继承自 `Light3D`。

```gdscript
# 创建一个点光源
var light := OmniLight3D.new()
light.light_color = Color(1.0, 0.7, 0.3)
light.omni_range = 10.0
add_child(light)
```

### 5.3 `GPUParticles3D` / `CPUParticles3D`：3D 粒子

**`GPUParticles3D`** 用 GPU 算粒子动画，性能好，能渲染上万粒子。
**`CPUParticles3D`** 用 CPU 算，能精确控制单个粒子（适合做技能子弹）。

两者关键属性类似：`amount`、`lifetime`、`emission_shape`、`process_material`、`mesh`、`emitting`。

### 5.4 `CSGShape3D` 系列：CSG 布尔运算

`CSGBox3D`、`CSGSphere3D`、`CSGCylinder3D`、`CSGPolygon3D` … 支持并 / 差 / 交运算。**适合快速搭原型**（例如碰撞器可视化），不适合放进正式游戏。

### 5.5 `Label3D`：3D 文字

```gdscript
extends Label3D

func _ready() -> void:
    text = "Hello, 3D"
    font_size = 64
    outline_size = 4
    billboard = BaseMaterial3D.BILLBOARD_ENABLED  # 永远朝向相机
```

---

## 6. 物理节点（CollisionObject 体系）

> 第 11 章会展开讲物理的全部细节。这里只列清单。

```text
CollisionObject2D                            ← 物理体的根
├── Area2D                                   ← 触发器（穿过会发信号，不阻挡）
└── PhysicsBody2D                            ← 实体（有质量 / 速度 / 阻挡）
    ├── StaticBody2D                         ← 不动：墙、地面
    ├── RigidBody2D                          ← 物理刚体：箱子、可推动物体
    └── CharacterBody2D                      ← 角色控制器：玩家、NPC

CollisionObject3D
├── Area3D
└── PhysicsBody3D
    ├── StaticBody3D
    ├── RigidBody3D
    └── CharacterBody3D
```

**共同的关键概念**：

- **`collision_layer` / `collision_mask`（int，32 位掩码）**：决定谁跟谁碰（详见第 11 章）
- **必须挂 `CollisionShape*` 子节点**：用 Shape 资源描述形状

### 6.1 一句话速查

| 节点 | 什么时候用 | 关键 API |
| --- | --- | --- |
| `StaticBody2D/3D` | 静态障碍物（墙、地） | `constant_linear_velocity`（传送带） |
| `RigidBody2D/3D` | 受重力的可推动物体 | `apply_impulse`、`apply_force` |
| `CharacterBody2D/3D` | 玩家 / NPC 的角色控制 | `move_and_slide`、`move_and_collide` |
| `Area2D/3D` | 触发区（拾取物、伤害判定） | `monitoring`、`area_entered` 信号 |

---

## 7. 工具节点

### 7.1 `Timer`：定时器

**一句话定位**：每隔 N 秒触发 `timeout` 信号。

**关键属性**：

| 属性 | 含义 |
| --- | --- |
| `wait_time: float` | 间隔秒数 |
| `one_shot: bool` | 是否只触发一次（默认 false 循环） |
| `autostart: bool` | 进 `_ready` 时自动启动 |
| `paused: bool` | 是否暂停 |

**最小示例**：

```gdscript
extends Timer

func _ready() -> void:
    wait_time = 1.5
    one_shot = false
    autostart = true
    timeout.connect(_on_timeout)

func _on_timeout() -> void:
    print("tick")
```

> 也可以用 `get_tree().create_timer(2.0)` 创建一次性定时器，结束后自动 `queue_free`。

### 7.2 `Tween`：补间动画

**一句话定位**：在指定时间内把属性从 A 平滑过渡到 B（替代手写 `_process` 里插值）。

**关键 API**：

```gdscript
func shoot() -> void:
    var t := create_tween()
    t.set_trans(Tween.TRANS_ELASTIC)    # 缓动函数
    t.set_ease(Tween.EASE_OUT)
    t.tween_property($Sprite, "scale", Vector2(1.5, 1.5), 0.3)
    t.tween_property($Sprite, "scale", Vector2.ONE, 0.2)
```

常用 `TRANS_*`：`LINEAR` / `SINE` / `QUAD` / `CUBIC` / `QUART` / `QUINT` / `EXPO` / `CIRC` / `ELASTIC` / `BACK` / `BOUNCE`。
常用 `EASE_*`：`IN` / `OUT` / `IN_OUT` / `OUT_IN`。

> 第 08 章动画也会讲到 tween 与 AnimationPlayer 的差异。

### 7.3 `AnimationPlayer` / `AnimationTree`

> 第 08 章专门讲。**先记一句话**：
>
> - `AnimationPlayer`：单条时间线上的轨道式动画（属性 / 方法 / 调用 / 音频）
> - `AnimationTree`：状态机 / BlendTree / 多动画融合

### 7.4 `AudioStreamPlayer` / `AudioStreamPlayer2D` / `AudioStreamPlayer3D`

| 节点 | 用途 |
| --- | --- |
| `AudioStreamPlayer` | 全局 2D 音乐（背景音乐 / UI 音效） |
| `AudioStreamPlayer2D` | 2D 空间音效（受位置 / 距离衰减影响） |
| `AudioStreamPlayer3D` | 3D 空间音效（HRTF、距离、遮挡） |

```gdscript
extends AudioStreamPlayer

func _ready() -> void:
    stream = preload("res://sfx/click.wav")
    play()
```

`AudioStream` 可以是 WAV / OGG / MP3，或 `.tres` 的 `AudioStreamRandomizer`（随机播放一组音效）。

---

## 8. 实战：选节点决策树

> 把上面所有节点浓缩成一张决策图。看完你写代码时能 1 秒选出正确的节点类型。

```mermaid
flowchart TD
  Start[我要加一个东西]
  Start --> Q1{是 UI 还是场景?}
  Q1 -- UI --> Control[Control 子类<br/>Button / Label / Panel / Container]
  Q1 -- 场景 --> Q2{2D 还是 3D?}
  Q2 -- 2D --> Q3{显示什么?}
  Q3 -- 单张图 --> Sprite2D
  Q3 -- 帧动画 --> AnimatedSprite2D
  Q3 -- 不规则形状 --> Polygon2D
  Q3 -- 文字 --> Label
  Q3 -- 什么也不显示，只参与物理 --> StaticBody2D
  Q3 -- 玩家/NPC --> CharacterBody2D
  Q3 -- 拾取物/触发器 --> Area2D
  Q2 -- 3D --> Q4{显示什么?}
  Q4 -- 模型 --> MeshInstance3D
  Q4 -- 光照 --> Light3D 系列
  Q4 -- 粒子 --> GPUParticles3D
  Q4 -- 文字 --> Label3D
  Q4 -- 不规则碰撞 --> StaticBody3D / CharacterBody3D / RigidBody3D

  Start --> T1{需要定时?}
  T1 -- 是 --> Timer
  Start --> T2{需要补间?}
  T2 -- 是 --> Tween
  Start --> T3{需要播放音乐?}
  T3 -- 是 --> AudioStreamPlayer 系列
  Start --> T4{需要动画?}
  T4 -- 单一轨道 --> AnimationPlayer
  T4 -- 状态机/混合 --> AnimationTree
```

---

## 9. demo：把今天讲的所有节点用一遍

demo 放在 `godot-demo/04-node-types/`，故意做一个"什么节点都挂一个"的小场景，所有节点都各做一件事。

> 截图占位：`<img src="/godot/04-02-demo-overview.png" />`（demo 运行截图——一个能看到所有节点工作的综合画面）

### 9.1 文件清单

```
04-node-types/
├── README.md
├── project.godot
├── Main.tscn                  ← 主场景，挂所有节点
├── scripts/
│   └── Main.gd                ← 主脚本，控制所有节点协同
├── icon.svg                   ← 共享贴图
├── audio/
│   └── beep.tres              ← 一个 AudioStream 资源（运行时生成）
└── tweens/
    └── BounceTween.gd         ← Tween 子脚本
```

### 9.2 `Main.tscn` 结构

```ini
[gd_scene load_steps=N format=3]

[ext_resource type="Script" path="res://scripts/Main.gd" id="1_main"]
[ext_resource type="Texture2D" path="res://icon.svg" id="2_icon"]
[ext_resource type="SpriteFrames" path="res://sprites/spinner.tres" id="3_spin"]

[node name="Main" type="Node2D"]
script = ExtResource("1_main")

[node name="Sprite2D_Static" type="Sprite2D" parent="."]
position = Vector2(200, 200)
modulate = Color(0.5, 1.0, 0.5, 1.0)

[node name="AnimatedSprite2D_Spinner" type="AnimatedSprite2D" parent="."]
position = Vector2(400, 200)
sprite_frames = ExtResource("3_spin")
autoplay = "default"

[node name="Polygon2D_Triangle" type="Polygon2D" parent="."]
position = Vector2(600, 200)
polygon = PackedVector2Array([Vector2(-40, 40), Vector2(40, 40), Vector2(0, -50)])
color = Color(1.0, 0.7, 0.2, 1.0)

[node name="Line2D_Trail" type="Line2D" parent="."]
points = PackedVector2Array([Vector2(100, 350), Vector2(200, 300), Vector2(300, 350)])
width = 4.0
default_color = Color(1, 1, 1, 1)

[node name="Label_Text" type="Label" parent="."]
offset_left = 800.0
offset_top = 180.0
offset_right = 1000.0
offset_bottom = 220.0
text = "Label 节点"

[node name="Timer_Tick" type="Timer" parent="."]
wait_time = 1.0
autostart = true

[node name="AudioStreamPlayer_Beep" type="AudioStreamPlayer" parent="."]

[node name="Tween_Bouncer" type="Node" parent="."]

[node name="Polygon2D_Bouncer" type="Polygon2D" parent="Tween_Bouncer"]
position = Vector2(200, 500)
polygon = PackedVector2Array([Vector2(-30, 0), Vector2(30, 0), Vector2(0, -50)])
color = Color(0.5, 0.5, 1.0, 1.0)
```

### 9.3 `scripts/Main.gd`

```gdscript
extends Node2D

@onready var spinner: AnimatedSprite2D = $AnimatedSprite2D_Spinner
@onready var beep: AudioStreamPlayer = $AudioStreamPlayer_Beep
@onready var bouncer: Polygon2D = $Tween_Bouncer/Polygon2D_Bouncer
@onready var tick: Timer = $Timer_Tick

var _elapsed: float = 0.0
var _line: PackedVector2Array


func _ready() -> void:
    spinner.play("default")
    tick.timeout.connect(_on_tick)

    # 用 Tween 给 bouncer 做无限循环的弹跳
    var t := create_tween().set_loops()
    t.tween_property(bouncer, "position:y", 450.0, 0.5)\
        .set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
    t.tween_property(bouncer, "position:y", 550.0, 0.5)\
        .set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

    # 用代码生成一个简单的 beep 音频流（440 Hz 正弦波，0.2 秒）
    beep.stream = _make_beep(440.0, 0.2)


func _process(delta: float) -> void:
    _elapsed += delta

    # Line2D 动态画一条会波动的线
    _line = PackedVector2Array()
    for i in range(60):
        var x: float = 100.0 + i * 20.0
        var y: float = 350.0 + sin(_elapsed * 4.0 + i * 0.3) * 30.0
        _line.append(Vector2(x, y))
    $Line2D_Trail.points = _line


func _on_tick() -> void:
    # Timer 触发，播放 beep
    beep.play()


## 用 AudioStreamGenerator 实时合成一个简单 beep
func _make_beep(freq: float, duration: float) -> AudioStreamGenerator:
    var gen := AudioStreamGenerator.new()
    gen.mix_rate = 44100.0
    gen.buffer_length = 0.2

    var playback: AudioStreamGeneratorPlayback = beep.get_stream_playback() if beep.stream else null
    # 简化处理：直接用一个 AudioStreamWAV 预生成静态波形
    var wav := AudioStreamWAV.new()
    wav.mix_rate = 44100
    wav.format = AudioStreamWAV.FORMAT_16_BITS
    var samples := PackedByteArray()
    var sample_count: int = int(44100 * duration)
    for i in range(sample_count):
        var t: float = float(i) / 44100.0
        var v: float = sin(2.0 * PI * freq * t) * 0.3 * (1.0 - t / duration)
        var sample: int = int(v * 32767.0)
        samples.append(sample & 0xff)
        samples.append((sample >> 8) & 0xff)
    wav.data = samples
    return wav
```

### 9.4 这个 demo 展示什么

| 节点 | 演示 |
| --- | --- |
| `Sprite2D` | 静态绿方块 |
| `AnimatedSprite2D` | 旋转动画 |
| `Polygon2D` | 三角形 |
| `Line2D` | 实时绘制的正弦曲线 |
| `Label` | 静态文字 |
| `Timer` | 每秒触发 beep |
| `AudioStreamPlayer` | 播放 440 Hz beep |
| `Tween` | 三角形无限循环弹跳 |
| `Node` | 空逻辑容器 |
| `_process` | 实时计算 Line2D 顶点 |

---

## 10. 易错清单

| 现象 | 原因 |
| --- | --- |
| `Sprite2D` 不显示 | `texture` 没设，或贴图透明度全为 0 |
| `AnimatedSprite2D` 没动画 | `SpriteFrames` 没绑 / 动画名拼错 |
| `Timer` 不触发 | 节点没 `add_child` 进场景树，或 `autostart` 没开 |
| `Tween` 结束不调用 `kill()` 内存泄漏 | 长生命周期节点要主动 `kill` |
| `Button` 按下没反应 | 没接 `pressed` 信号，或父 Control 把输入消费了 |
| `Camera2D/3D` 没效果 | 没调 `make_current()`，或没放在对的位置 |
| `MeshInstance3D` 全黑 | 没接灯光，材质 `shading_mode` 是 `UNSHADED` |
| `Area2D` 不触发 `body_entered` | Layer / Mask 配置错（详见第 11 章） |
| `CharacterBody2D` 移动穿墙 | 物理帧率与渲染帧率不一致；放在 `_physics_process` 里 |

---

## 11. 章节小结

- **基础节点**：`Node` 只挂逻辑；`Node2D` / `Node3D` 加空间变换
- **2D 渲染**：Sprite2D / AnimatedSprite2D / Polygon2D / Line2D / Label / TextureRect
- **3D 渲染**：MeshInstance3D / Light3D / Camera3D / GPUParticles3D / Label3D
- **UI**：Control 体系（Container / Button / Label / Panel …）
- **物理**：StaticBody / RigidBody / CharacterBody / Area 4 类（+ 各自的 CollisionShape）
- **工具**：Timer / Tween / AnimationPlayer / AnimationTree / AudioStreamPlayer
- **决策树**：UI → Control；2D / 3D 看显示什么；逻辑 / 定时 / 补间 / 动画 / 音效 各有专门节点

下一章 [05 · GDScript 语法基础](./05-gdscript-syntax.md)，我们系统过一遍 GDScript 的语法——读完后你就能看懂这章里所有的 `extends` / `@export` / `@onready` / `_ready` / `_process` 到底是什么意思。

---

## 📷 本章截图清单

| 文件名 | 内容 | 截屏步骤 |
| --- | --- | --- |
| `04-01-add-node-dialog.png` | Create New Node 对话框（搜索框 + 节点分类列表） | Scene Dock 顶部 + 按钮 → 截图搜索框 |
| `04-02-demo-overview.png` | demo 运行截图：所有节点同框工作 | F5 运行 demo 后截图 |