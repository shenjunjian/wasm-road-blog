# 11 · 物理系统 2D / 3D 与碰撞检测

> 占位章节，待撰写。

本章计划内容：

- 碰撞体类型：CollisionShape2D / CollisionShape3D、CollisionPolygon2D
- 物理形状：矩形、圆形、胶囊、凸多边形、网格（ConcavePolygonShape3D）
- 物理体：StaticBody、RigidBody、CharacterBody、Area
- Layer 与 Mask：32 层掩码机制
- 信号：`body_entered`、`area_entered`、`input_event`
- RayCast2D / RayCast3D：射线检测原理
- PhysicsServer 概念：物理体在引擎中的运行循环（fixed FPS 60）
- 2D 与 3D 物理在 Godot 中的实现差异：独立世界、不可混用

所需截图：

- `11-01-collision-shape.png`
- `11-02-layer-mask.png`
- `11-03-debug-collisions.png`

配套 demo：`godot-demo/11-physics/`
