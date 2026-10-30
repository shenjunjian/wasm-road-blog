# 04 · 节点全览：把今天讲的节点都跑一遍

> 对应博客：[04 · 节点类型全览与重要节点详解](../../blog-vp-site/godot/04-node-types.md)

## 启动

1. 用 Godot 4.3+ 打开本目录里的 `project.godot`。
2. 按 **F5**。窗口里能看到：
   - 顶行：5 个静态元素——Sprite2D / AnimatedSprite2D / Polygon2D / Line2D / Label
   - 中间：实时波动的正弦曲线（Line2D 在 _process 里每帧重算）
   - 底部：蓝色三角形用 Tween 无限循环上下弹跳
   - 每秒：Timer 触发 → 播放 440 Hz beep（0.2 秒）
3. 下方 Output 面板每秒打印一行 `timer tick at ... ms`。

## 这个 demo 演示什么

| 节点 | 演示内容 |
| --- | --- |
| `Node2D` | 根节点，承载所有子节点 |
| `Sprite2D` | 静态绿色圆球（modulate 调色） |
| `AnimatedSprite2D` | 单帧 sprite 循环（autoplay="default"） |
| `Polygon2D` | 橙色三角形（顶点数组构造） |
| `Line2D` | 白色正弦曲线（_process 实时算点） |
| `Label` | 静态文本 "Label 节点 (Control)" |
| `Timer` | 每秒触发一次 timeout |
| `AudioStreamPlayer` | 播放运行时合成的 440 Hz 正弦波 |
| `Tween` | 三角形无限循环上下弹跳 |
| `Node` | Tween_Bouncer 是纯逻辑容器 |

## 关键文件

```
04-node-types/
├── README.md
├── project.godot
├── icon.svg
├── spinner.tres               # AnimatedSprite2D 用的 SpriteFrames 资源
├── Main.tscn                  # 主场景，挂所有演示节点
└── scripts/
    └── Main.gd                # 启动动画 + Timer + Tween + 实时 Line2D
```

## 自己动手改一改

| 想验证的现象 | 改法 |
| --- | --- |
| 调弹跳速度 | Main.gd 里 `0.5` 改 `0.2`（更快）或 `1.5`（更慢） |
| 改弹跳缓动 | `.set_trans(Tween.TRANS_SINE)` 换成 `TRANS_BOUNCE` |
| 改 beep 频率 | `_make_beep(440.0, 0.2)` 改成 `_make_beep(880.0, 0.3)` |
| 让 Line2D 不再画 | Main.gd `_process` 改成注释掉那一段 |
| 让 Polygon2D 旋转 | 在 Main.gd `_process` 加 `bouncer.rotation += 0.02` |

## 关键观察点

- **Sprite2D 与 AnimatedSprite2D 视觉相同**：因为 spinner.tres 只注册了一帧。SpriteFrames 可以加多帧实现真动画
- **Line2D 是动态构造的**：每帧重算 60 个点，CPU 开销约 0.1 ms，可以接受
- **Tween 不需要节点**：直接 `create_tween()` 即可
- **beep 听不见？** 多数笔记本扬声器对 440 Hz 很敏感，但静音了肯定听不到——开音量