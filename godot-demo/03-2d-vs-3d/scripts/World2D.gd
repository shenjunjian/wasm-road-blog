extends CanvasLayer
## 第 03 章 demo：上半屏 2D 子场景
##
## 这个脚本演示 CanvasItem 体系：Sprite2D + 2D 像素坐标 + z_index。

@export var speed: float = 200.0
@onready var sprite: Sprite2D = $Sprite2D

var _direction: int = 1


func _process(delta: float) -> void:
	# 2D 像素坐标系：position.x 单位是屏幕像素
	sprite.position.x += speed * delta * _direction

	# 上半屏宽 1280，居中位置 640，半宽 640
	if sprite.position.x > 640.0:
		sprite.position.x = 640.0
		_direction = -1
	elif sprite.position.x < -640.0:
		sprite.position.x = -640.0
		_direction = 1
