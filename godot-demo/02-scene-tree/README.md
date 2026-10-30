# 02 · 场景·节点·树·继承：玩家发射子弹

> 对应博客：[02 · 核心概念：场景、节点、树与继承](../../blog-vp-site/godot/02-scene-tree.md)

## 启动

1. 用 Godot 4.3+ 打开本目录里的 `project.godot`。
2. 第一次打开会扫资源生成 `.import/`，**全部接受默认**。
3. 按 **F5**。窗口里能看到一个圆球方块在底部，按 **← →** 左右移动，按 **空格** 发射子弹。

## 这个 demo 演示什么

| 概念 | 落点 |
| --- | --- |
| 节点（Node） | `.tscn` 里每个 `[node ...]` 段都是节点 |
| 场景（Scene） | `Player.tscn` / `Bullet.tscn` / `Main.tscn` 三份独立场景 |
| 实例化（Instance） | `Main.tscn` 里 `instance=ExtResource("2_player")` 把 Player 嵌入进来 |
| PackedScene + instantiate | `Main.gd` 里 `bullet_scene.instantiate()` 动态创建子弹 |
| `@export` | `bullet_scene: PackedScene` 拖入资源；`speed: float` 调速度 |
| `@onready` | `player = $Player` 在 `_ready` 时取子节点引用 |
| `_process` vs `_physics_process` | Main 用 `_process`（输入），Player / Bullet 用 `_physics_process`（物理移动） |
| `queue_free()` | Bullet 出界后安全释放 |

## 关键文件

```
02-scene-tree/
├── README.md
├── project.godot
├── icon.svg
├── Player.tscn             # 玩家场景（独立可复用）
├── Bullet.tscn             # 子弹场景（独立可复用）
├── Main.tscn               # 主场景，嵌入 Player 实例化
└── scripts/
    ├── Main.gd             # 处理输入 + 子弹生成
    ├── Player.gd           # 移动
    └── Bullet.gd           # 自动飞行 + 出界销毁
```

## 自己动手改一改

| 想验证的现象 | 改法 |
| --- | --- |
| 子弹也左右飞 | Bullet.gd 的 `_physics_process` 里 `position.x += sin(...)` 加一行 |
| 玩家能上下移动 | Player.gd 里加上 `velocity.y = ...` 用 `ui_up` / `ui_down` |
| 子弹撞到玩家销毁 | Bullet.gd 加 `func _on_body_entered(body): if body is Player: queue_free()`，并连信号 |
| 限制子弹数量 | Main.gd 里 `bullets.get_child_count() < 30` 才发射 |

## 验证"实例化 vs 继承"

1. 在 `Main.tscn` 里选中 `Player` 实例化节点。
2. 在 Inspector 里改它的 `Speed` 字段——会发现字段变**橙色**，这是被父场景覆写。
3. 把 `Player.tscn` 里 `speed = 320.0` 改成 `500.0` 并保存。
4. 回到 `Main.tscn` 看 Player 节点——`Speed` 字段显示的还是 `320.0`（**保留覆写**），但如果你点 Instance 编辑器菜单的 **Open in Editor** 进入子场景，会看到 `500.0` 已生效。

## 验证生命周期

在 `Main.gd` / `Player.gd` / `Bullet.gd` 里分别加 `_enter_tree()` / `_ready()` / `_exit_tree()`，里面只 `print("X in _Y")`，看 F5 运行后 Output 面板的打印顺序：

```
Main._enter_tree()
Player._enter_tree()
Player._ready()
Main._ready()
Bullet._enter_tree()   (每次发射)
Bullet._ready()
Bullet._exit_tree()    (每次出界)
```
