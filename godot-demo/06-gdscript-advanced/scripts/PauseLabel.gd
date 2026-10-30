extends Label
## 暂停标签：监听 GameState.paused_changed 信号

func _ready() -> void:
	visible = false
	text = "PAUSED — 按 P 继续"
	GameState.paused_changed.connect(_on_paused_changed)


func _on_paused_changed(paused: bool) -> void:
	visible = paused
