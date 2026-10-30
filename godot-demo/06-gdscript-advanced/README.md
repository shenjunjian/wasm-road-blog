# 06 · GDScript 进阶：信号 + Autoload + 场景切换

> 对应博客：[06 · GDScript 进阶、信号与运行时 API](../../blog-vp-site/godot/06-gdscript-advanced.md)

## 启动

1. 用 Godot 4.3+ 打开本目录里的 `project.godot`。
2. 按 **F5**。先看到菜单 → 按 **空格** 进入主场景。
3. 主场景：玩家方块在底部，左右键移动；每隔 2 秒自动扣 10 血；扣到 0 弹出 GameOver。

## 操作

| 按键 | 效果 |
| --- | --- |
| ← → | 移动玩家 |
| 空格 | 加 10 分（演示 Autoload + setter 信号） |
| P | 暂停 / 继续（演示 Autoload PROCESS_MODE_ALWAYS） |
| R | 死亡后回菜单（演示 change_scene_to_file + Autoload.reset） |

## 这个 demo 演示什么

| 概念 | 落点 |
| --- | --- |
| **信号声明 / emit / connect** | `Player.hp_changed` / `Player.died` |
| **`@export` 节点引用** | `HealthBar.player`、`GameOverLabel.player` |
| **编辑器和代码两种 connect** | HealthBar 用代码连；GameOverLabel 用代码连 |
| **Autoload** | `GameState` 单例，跨场景保留 score / is_paused |
| **Autoload + PROCESS_MODE_ALWAYS** | P 暂停时 GameState 仍能响应（`process_mode = Node.PROCESS_MODE_ALWAYS`） |
| **setter 触发信号** | `score` setter 触发 `score_changed` |
| **场景切换** | Menu → Main → Menu |
| **`is_instance_valid` + `await`** | Main 里的 `_damage_loop` 异步循环 |
| **`Input.get_axis`** | 玩家移动 |
| **`match` 多个按键** | Main._unhandled_input 分发 |

## 关键文件

```
06-gdscript-advanced/
├── README.md
├── project.godot                          # 已注册 GameState autoload
├── icon.svg
├── autoload/
│   └── GameState.gd                       # 全局单例
├── Main.tscn                              # 主场景（Player + UI + DamageZone + Wall）
├── Menu.tscn                              # 简单菜单
└── scripts/
    ├── Main.gd                            # 主场景脚本
    ├── Menu.gd                            # 菜单脚本
    ├── Player.gd                          # 玩家 + 信号
    ├── HealthBar.gd                       # 监听 hp_changed
    ├── GameOverLabel.gd                   # 监听 died
    ├── ScoreLabel.gd                      # 监听 score_changed
    └── PauseLabel.gd                      # 监听 paused_changed
```

## 自己动手改一改

| 想验证的现象 | 改法 |
| --- | --- |
| 玩家与 DamageZone 接触才掉血（而不是自动扣） | Main.gd 删掉 `_damage_loop`，给 DamageZone 加 `body_entered` 信号，调用 `player.take_damage(10)` |
| 暂停时玩家也能动 | 把 Player 的 `process_mode` 设 `PROCESS_MODE_DISABLED`（默认是 INHERIT 跟随父） |
| 加多一个 Enemy | 复制 Player.tscn 改名为 Enemy.tscn，加一组巡逻脚本，挂在 DamageZone 旁 |
| 用编辑器连信号而不是代码 | 选中 Player → Inspector → Signals → 双击 hp_changed → 选 HealthBar + _on_hp_changed。然后把 HealthBar.gd 里的 `player.hp_changed.connect(...)` 删掉 |

## 关键观察点

- **Autoload 不消失**：从 Menu 切到 Main、再切回 Menu，`GameState.score` 一直保留
- **setter 信号**：每次 `GameState.score += 10` 都会触发 `score_changed` → ScoreLabel 自动更新（不需要主动调用 UI 刷新）
- **PROCESS_MODE_ALWAYS**：按 P 暂停后，UI 和 Player 都停了，但 GameState 仍然响应 `toggle_pause()` —— 看 Output 面板的打印
- **`is_instance_valid`**：`_damage_loop` 里反复检查 player 是否还活着，避免死亡后访问已释放的节点

## 验证信号流

F5 → Main 场景后，Output 面板会看到类似：

```
[GameState] initialized
player take_damage 100→90
player take_damage 90→80
...
player take_damage 10→0
```
