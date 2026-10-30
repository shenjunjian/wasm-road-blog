extends Node2D
## 第 02 章 demo：主控制器
##
## 对应博客第 02 章第 9 节。
##
## 这个脚本演示：
##   - @export PackedScene：把 .tscn 当资源拖入 Inspector
##   - @onready：用 $NodeName 在 _ready 时取子节点引用
##   - 实例化（instantiate）+ add_child
##   - _process（输入轮询，渲染帧）
##   - Input.get_axis(...) 读取 ui_left / ui_right

## 如果你在 Inspector 里没手动拖子弹场景，这里兜底用 preload 加载
@export var bullet_scene: PackedScene = preload("res://Bullet.tscn")
@export var fire_rate: float = 0.2

# @onready 等价于：var player; func _ready(): player = $Player
@onready var player: CharacterBody2D = $Player
@onready var bullets: Node2D = $BulletContainer

var _fire_cd: float = 0.0


func _process(delta: float) -> void:
	# 倒计时发射冷却
	_fire_cd -= delta

	# ui_accept 是 Project Settings → Input Map 里默认就有的"接受"动作（Space / Enter）
	if Input.is_action_pressed("ui_accept") and _fire_cd <= 0.0:
		_fire()
		_fire_cd = fire_rate


func _fire() -> void:
	# bullet_scene 是 @export，编辑器拖入 Bullet.tscn；如果忘了拖就用 preload 兜底
	if bullet_scene == null:
		bullet_scene = preload("res://Bullet.tscn")
	var b: Node2D = bullet_scene.instantiate()
	bullets.add_child(b)
	b.global_position = player.global_position + Vector2(0, -40)
