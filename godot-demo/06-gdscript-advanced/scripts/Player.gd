extends CharacterBody2D
## 玩家：发射 hp_changed / died 信号
##
## 演示：
##   - 自定义信号 + emit
##   - @export 暴露参数
##   - @onready 取子节点引用
##   - _physics_process 里 move_and_slide

signal hp_changed(new_hp: int, max_hp: int)
signal died

@export var hp: int = 100
@export var max_hp: int = 100
@export var speed: float = 250.0

@onready var sprite: Sprite2D = $Sprite


func _physics_process(_delta: float) -> void:
	var dir: float = Input.get_axis("ui_left", "ui_right")
	velocity.x = dir * speed
	move_and_slide()


func take_damage(amount: int) -> void:
	hp = max(0, hp - amount)
	hp_changed.emit(hp, max_hp)
	if hp == 0:
		died.emit()


## 当撞到伤害区（红色方块）时被伤害区调用
func apply_damage(amount: int) -> void:
	take_damage(amount)
