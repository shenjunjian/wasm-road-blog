extends Node2D
## 第 01 章 demo：会动的方块
##
## 这一份脚本对应博客里的"第一个场景：Hello, Godot"一节。
## 配套阅读：blog-vp-site/godot/01-overview.md 第 7 节。
##
## 演示的几个引擎概念：
##   - extends Node2D：本脚本挂在 Node2D 上，跟随其变换
##   - @export：把 speed 暴露到 Inspector，运行时可视化调速
##   - _process(delta)：每渲染帧调用一次，delta 是距上一帧的秒数
##   - get_viewport_rect()：拿到当前 Viewport 的尺寸（像素）

# @export 把变量提升为可编辑属性，可以在 Inspector 面板直接拖滑块改值，
# 不必每次改代码重新运行。带类型注解或 := 推断才能被 Inspector 识别。
@export var speed: float = 200.0

# 方向状态：1 向右，-1 向左。私有约定：以下划线开头的变量编辑器不会显示。
var _direction: int = 1


func _process(delta: float) -> void:
	# 每帧让 position.x 按 speed 推进 _direction 个方向
	position.x += speed * delta * _direction

	# 取当前视口尺寸，撞到边界就反向
	var screen_size: Vector2 = get_viewport_rect().size

	if position.x > screen_size.x:
		position.x = screen_size.x
		_direction = -1
	elif position.x < 0.0:
		position.x = 0.0
		_direction = 1
