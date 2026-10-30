extends ProgressBar
## 血条：监听 Player.hp_changed 信号

@export var player: CharacterBody2D


func _ready() -> void:
	max_value = 100.0
	value = 100.0
	if player:
		player.hp_changed.connect(_on_hp_changed)


func _on_hp_changed(new_hp: int, max_hp: int) -> void:
	max_value = float(max_hp)
	value = float(new_hp)
