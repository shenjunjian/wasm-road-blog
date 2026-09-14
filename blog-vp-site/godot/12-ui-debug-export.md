# 12 · UI、调试与跨平台导出

> 占位章节，待撰写。

本章计划内容：

- **UI**
  - Control 节点：锚点（Anchor）、边距（Margin）
  - 容器：VBoxContainer、HBoxContainer、GridContainer、FlowContainer
  - 主题 Theme：.tres 文件 + StyleBox
  - 常用控件：Button、LineEdit、TextureButton、ProgressBar
  - 信号：pressed / text_changed / value_changed
- **调试**
  - Debugger 面板：Breakpoints、Stack Trace
  - Profiler：CPU / GPU 帧耗时
  - `print`、`push_warning`、`push_error`
  - 远程调试 / 部署到移动设备
- **跨平台导出**
  - 导出预设：Windows / macOS / Linux / Web / Android / iOS
  - Web 导出：HTML5 + SharedArrayBuffer + COEP/COOP
  - 移动端：签名、权限、性能注意点

所需截图：

- `12-01-control-anchors.png`
- `12-02-theme.png`
- `12-03-debugger.png`
- `12-04-export-presets.png`

配套 demo：`godot-demo/12-ui-debug-export/`
