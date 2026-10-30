extends CharacterBody2D
## 第 02 章 demo：玩家
##
## 演示 _physics_process 里调用 move_and_slide——
## 物理移动必须放在 _physics_process 而不是 _process。

@export var speed: float = 320.0


func _physics_process(delta: float) -> void:
	# ui_left / ui_right 在 project.godot 的 [input] 段定义
	var dir := Input.get_axis("ui_left", "ui_right")
	velocity.x = dir * speed
	move_and_slide()
