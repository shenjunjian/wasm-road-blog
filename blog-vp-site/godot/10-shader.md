# 10 · GDScript Shader 编写

> 占位章节，待撰写。

本章计划内容：

- shader 类型
  - `shader_type spatial`：3D 表面
  - `shader_type canvas_item`：2D 绘制
  - `shader_type sky`：天空盒
  - `shader_type fog`：体积雾
- `render_mode`：`blend_mix / blend_add / unshaded / cull_back / depth_draw_opaque`
- `uniform`：从脚本传到 shader 的变量
- `varying`：顶点 → 片元的插值数据
- 2D 最小示例：UV 流动（fract + TIME）
- 3D 最小示例：法线扰动 + Lambert 光照
- 后处理：`hint_screen_texture` 抓屏 + 全屏 quad
- 性能注意：避免分支、降低纹理采样次数、合理 LOD

所需截图：

- `10-01-shader-editor.png`
- `10-02-shader-material.png`
- `10-03-flow-uv-result.png`

配套 demo：`godot-demo/10-shader/`
