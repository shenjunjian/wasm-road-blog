# 07 · 资源系统与文件系统

> 占位章节，待撰写。

本章计划内容：

- Resource 是什么：可序列化的、可被节点引用的数据对象
- 内置资源类型
  - Texture2D / Texture3D / CompressedTexture2D
  - SpriteFrames
  - AnimationLibrary
  - PackedScene
  - Material（StandardMaterial3D、ShaderMaterial…）
  - Shader
  - AudioStream
  - Theme
- 自定义 Resource：`class_name MyData extends Resource`
- `ResourceLoader` / `ResourceSaver`：手动加载与保存
- 文件系统面板：res:// 协议、导入机制、`.import` 文件
- 编辑器如何把 PNG / FBX / GLB / WAV 转成引擎资源

所需截图：

- `07-01-fs-panel.png`
- `07-02-import-tab.png`
- `07-03-custom-resource.png`

配套 demo：`godot-demo/07-resources/`
