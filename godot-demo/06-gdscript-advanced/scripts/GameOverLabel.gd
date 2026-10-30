extends Label
## GameOver 标签：监听 Player.died 信号，按 R 回菜单

@export var player: CharacterBody2D


func _ready() -> void:
	visible = false
	text = "GAME OVER — 按 R 回菜单"
	if player:
		player.died.connect(_on_died)


func _on_died() -> void:
	visible = true


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if (event as InputEventKey).keycode == KEY_R and visible:
			GameState.reset()
			get_tree().change_scene_to_file("res://Menu.tscn")
