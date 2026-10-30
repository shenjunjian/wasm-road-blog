extends Control
## 简单菜单：按空格进入主场景

@onready var hint_label: Label = $HintLabel


func _ready() -> void:
	GameState.reset()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if (event as InputEventKey).keycode == KEY_SPACE:
			get_tree().change_scene_to_file("res://Main.tscn")
