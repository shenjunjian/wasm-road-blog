# 06 · GDScript 进阶、信号与运行时 API

> 占位章节，待撰写。

本章计划内容：

- 静态类型：函数返回值 / 参数类型、类型推断的限制
- `@export` 导出变量到 Inspector：`@export var speed: float = 200`
- `@onready var x = $NodePath` 等价于 `_ready` 时再赋值
- `@rpc` 远程调用（多人游戏基础）
- 信号：声明 `signal`、连接 `connect`、自定义信号、参数化信号
- 节点查询：`get_node`、`$` 简写、`%` 唯一名、`NodePath`
- Autoload 单例（Project Settings → AutoLoad）
- 场景切换：`get_tree().change_scene_to_packed`
- 资源加载：`ResourceLoader.load` / `load_threaded_request` 异步
- 常用运行时 API：`Input`、`Engine`、`OS`、`Time`、`JSON`

所需截图：

- `06-01-signal-panel.png`
- `06-02-autoload.png`
- `06-03-debugger.png`

配套 demo：`godot-demo/06-gdscript-advanced/`
