# 09 · 2D TileMap / TileSet 与 3D 材质

> 占位章节，待撰写。

本章计划内容：

- **2D 部分**
  - TileSet：纹理集、Atlas、physical layer、navigation layer
  - TileMap：单元格大小、绘制模式、terrain 自动拼接
  - 半自动与全自定义：Autotile 物理碰撞、NavigationRegion2D
- **3D 材质**
  - 材质分类：StandardMaterial3D、ORMMaterial3D、ShaderMaterial
  - PBR 四大属性：Albedo、Metallic、Roughness、Emission
  - UV 与纹理工作流：tiling、repeat、offset
  - 多 MeshInstance 共享一个 .tres 材质的批处理原理

所需截图：

- `09-01-tileset-editor.png`
- `09-02-tilemap-draw.png`
- `09-03-material-inspector.png`
- `09-04-pbr-sphere.png`

配套 demo：`godot-demo/09-tile-material/`
