# 03 · 2D vs 3D：同屏对比

> 对应博客：[03 · 2D 与 3D：选型与关键区别](../../blog-vp-site/godot/03-2d-vs-3d.md)

## 启动

1. 用 Godot 4.3+ 打开本目录里的 `project.godot`。
2. 按 **F5**。窗口里：
   - **上半屏**：深蓝灰色背景，圆球方块左右移动
   - **下半屏**：黄色立方体持续绕 Y 轴旋转
3. 这是**同一棵场景树里的 2D 和 3D 子场景并存**——演示 CanvasItem 与 Node3D 共存。

## 这个 demo 演示什么

| 概念 | 落点 |
| --- | --- |
| 节点类型分叉 | `Node2D`（Sprite2D 在 CanvasLayer 里）+ `Node3D`（MeshInstance3D 在主画布） |
| 坐标体系分叉 | `Sprite2D.position` 是像素坐标，`MeshInstance3D.position` 是世界单位（米） |
| CanvasLayer 隔离 | 2D 子场景不受 3D 摄像机影响 |
| Camera3D + DirectionalLight3D | 下半屏有透视投影与阴影 |
| Label3D | 在 3D 世界里画文字（演示 3D 文本节点） |

## 关键文件

```
03-2d-vs-3d/
├── README.md
├── project.godot
├── icon.svg
├── Main.tscn             # 根 Node3D + CanvasLayer 嵌入 World2D
├── World2D.tscn          # CanvasLayer + Sprite2D + Label
├── World3D.tscn          # Node3D + Camera3D + MeshInstance3D + DirectionalLight3D + Label3D
└── scripts/
    ├── Main.gd           # 占位
    ├── World2D.gd        # 2D 方块左右移动
    └── World3D.gd        # 3D 立方体绕 Y 旋转
```

## 自己动手改一改

| 想验证的现象 | 改法 |
| --- | --- |
| 改 2D 方块颜色 | World2D.tscn 里把 Sprite2D 节点的 `modulate` 改成红 / 绿 |
| 改 3D 立方体材质 | World3D.tscn 里 `surface_material_override/0` 改 albedo / metallic |
| 让 3D 立方体边走边转 | World3D.gd 里加 `position.z += 0.5 * delta`，注意别走出去 |
| 调 2D 移动速度 | World2D.tscn 选中 World2D 节点，在 Inspector 里把 `Speed` 调到 600 |
| 让 2D 也能在 Y 轴动 | World2D.gd 加 `sprite.position.y = sin(...)` |
| 在 3D 场景里放 2D UI | Main.tscn 加 `CanvasLayer` + `Control` + `Label` |

## 关键观察点

- **2D 方块无论怎么走都"贴"在上半屏**：因为它在 CanvasLayer 里，**不受 3D Camera3D 影响**
- **3D 立方体看得见背面的话，会自动被前面挡住**：GPU 的深度缓冲自动处理
- **Label3D 跟随 3D 视角旋转**：你转 Camera3D 时字也跟着转——这与 Label（2D）永远水平不同

## 切换渲染管线

Project Settings → Rendering → Renderer → Rendering Method：
- `forward_plus`：默认，桌面最佳
- `mobile`：移动平台优化
- `compatibility`：老设备回退

切换后**不用改代码、不用改场景**，直接重跑 demo。
