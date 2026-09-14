# 08 · 动画系统：AnimationPlayer 与 AnimationTree

> 占位章节，待撰写。

本章计划内容：

- AnimationPlayer：属性轨道、方法轨道、调用轨道、音频轨道
- 关键帧与插值：线性、贝塞尔（`EDITOR_HANDLE_IN_OUT` 等）
- 动画播放器：play / pause / stop / seek / current_animation
- AnimationTree：状态机（StateMachine）+ BlendTree
- BlendTree 节点类型：Blend2 / Blend3 / Animation / TimeScale / Transition
- Animation Library：把动画按集合分组复用
- 动画与脚本协同：`AnimationPlayer.animation_finished` 信号

所需截图：

- `08-01-animation-editor.png`
- `08-02-keyframes.png`
- `08-03-animation-tree.png`
- `08-04-blend-tree.png`

配套 demo：`godot-demo/08-animation/`
