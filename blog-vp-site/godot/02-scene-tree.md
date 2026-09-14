# 02 · 核心概念：场景、节点、树与继承

> 占位章节，待撰写。

本章计划内容：

- 节点（Node）的本质：一个有类型、有父节点、有生命周期回调的对象
- 场景（Scene）= 一个以节点为根的子树，保存为 `.tscn` / `.escn`
- 场景树（SceneTree）：引擎运行时所有节点的根容器
- 实例化（Instancing）：把别的场景作为子节点复用
- 继承（Inherit）：在编辑器里「右键 → Inherit」创建子场景
- `@export` 把节点引用暴露到 Inspector，避免硬编码 NodePath
- 节点生命周期：`_enter_tree` / `_ready` / `_process` / `_physics_process` / `_exit_tree`

所需截图：

- `02-01-scene-tree.png`
- `02-02-instance.png`
- `02-03-inherit.png`
- `02-04-inspector-export.png`

配套 demo：`godot-demo/02-scene-tree/`
