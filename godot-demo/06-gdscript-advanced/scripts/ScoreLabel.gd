extends Label
## 分数标签：监听 GameState.score_changed 信号

func _ready() -> void:
	text = "Score: 0"
	GameState.score_changed.connect(_on_score_changed)


func _on_score_changed(new_score: int) -> void:
	text = "Score: %d" % new_score
