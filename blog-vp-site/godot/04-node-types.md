# 04 · 节点类型全览与重要节点详解

> 占位章节，待撰写。

本章计划内容：

按继承层级分组梳理：

- **Node 基类**：所有节点之父
- **CanvasItem / Node2D**：2D 渲染节点
  - Sprite2D、AnimatedSprite2D、Polygon2D、Line2D、MeshInstance2D
- **Control**：UI 节点（Container、Button、Label、TextureButton…）
- **Node3D**：3D 渲染节点
  - MeshInstance3D、DirectionalLight3D、Camera3D、GPUParticles3D、CSGBox3D
- **物理节点**
  - StaticBody2D/3D、RigidBody2D/3D、CharacterBody2D/3D、Area2D/3D
- **工具节点**
  - Timer、Tween、AnimationPlayer、AnimationTree、AudioStreamPlayer

每个节点配「一句话定位 + 一个最小示例场景」。

所需截图：

- `04-01-node-tree-classes.png`
- `04-02-add-node-dialog.png`
- `04-03-mesh-instance.png`

配套 demo：`godot-demo/04-node-types/`
