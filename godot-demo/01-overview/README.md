# 01 · 概览与编辑器：会动的方块

> 对应博客：[01 · Godot 4.x 概览与编辑器入门](../../blog-vp-site/godot/01-overview.md)

## 启动

1. 用 Godot 4.3+ 打开本目录里的 `project.godot`（Project Manager → Import）。
2. 第一次 Import 会扫资源生成 `.import/`，**全部接受默认**，完成即可。
3. 按 **F5** 运行。窗口里会看到一个带描边圆点的小圆球在水平方向上来回弹跳。
4. **暂停 / 停止**：编辑器顶部中间的运行控制条。

## 这个 demo 演示什么

- 创建一个 `Node2D` 根 + `Sprite2D` 子节点的最小场景（`Main.tscn`）。
- 用脚本（`Main.gd`）驱动位置变化，对应 `_process(delta)` 的逐帧调用。
- `@export var speed` 把速度暴露到 Inspector，你可以选中根节点后**实时拖滑块**调速。
- 撞到视口边界时反弹，对应 `get_viewport_rect()` 取屏幕尺寸。

## 关键文件

| 文件 | 作用 |
| --- | --- |
| `project.godot` | Godot 项目入口：声明主场景、窗口尺寸、渲染管线 |
| `Main.tscn` | 场景文件（`.tscn` 是文本格式，可用 git diff 看） |
| `Main.gd` | 挂在 Main 节点上的脚本，实现"逐帧移动 + 反弹"逻辑 |
| `icon.svg` | Sprite2D 的占位贴图（Godot 项目自带的同款默认图标风格） |

## 自己动手改一改

| 想验证的现象 | 改法 |
| --- | --- |
| 让方块走斜线 | `position.y += 50.0 * delta` 加一行 |
| 改成鼠标拖动 | 在 `_process` 里 `position = get_global_mouse_position()` |
| 跑得更快 | 选中 Main 节点，把 Inspector 里 `Speed` 调到 600 |
| 让方块掉到屏幕外 | `print(position)` 加在 `_process` 末尾，看 Output 面板 |

## 文件清单

```
01-overview/
├── README.md       # 本文件
├── project.godot   # 项目入口
├── Main.tscn       # 主场景
├── Main.gd         # 根节点脚本
└── icon.svg        # Sprite2D 占位贴图
```
