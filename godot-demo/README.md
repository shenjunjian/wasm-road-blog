# godot-demo

按章节组织 Godot 4.x 示例工程。每个子目录都是一个**独立的 Godot 项目**（带 `project.godot`），可以用 Godot 4.3+ 直接打开运行。

## 目录结构

```
godot-demo/
├── 01-overview/             # 第 01 章：空项目跑通 Hello World
├── 02-scene-tree/           # 第 02 章：场景实例化 + 继承
├── 03-2d-vs-3d/             # 第 03 章：2D 与 3D 最小对比
├── 04-node-types/           # 第 04 章：常见节点 demo 集
├── 05-gdscript-syntax/      # 第 05 章：语法速查示例
├── 06-gdscript-advanced/    # 第 06 章：信号 + autoload + 异步加载
├── 07-resources/            # 第 07 章：自定义 Resource
├── 08-animation/            # 第 08 章：AnimationPlayer + AnimationTree
├── 09-tile-material/        # 第 09 章：TileMap + StandardMaterial3D
├── 10-shader/               # 第 10 章：UV 流动 + Lambert
├── 11-physics/              # 第 11 章：CharacterBody + RigidBody
└── 12-ui-debug-export/      # 第 12 章：UI + 导出预设
```

## 使用方式

1. 安装 [Godot 4.3+](https://godotengine.org/download)（推荐标准版，非 .NET 版）。
2. 在 Godot Project Manager 中点击 **Import**，定位到任一子目录里的 `project.godot`。
3. F5 运行。

## 与文章配合

每章正文中引用的 demo 文件路径形如 `godot-demo/06-gdscript-advanced/`，请按章节目录对应。
