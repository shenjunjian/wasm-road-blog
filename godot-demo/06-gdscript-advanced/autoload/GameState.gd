extends Node
## 全局游戏状态（Autoload）
##
## 在 Project Settings → AutoLoad 注册为 "GameState"。
## 任何脚本都能直接用 GameState.score / GameState.is_paused。
##
## 演示：
##   - setter 触发信号
##   - PROCESS_MODE_ALWAYS（暂停时也跑）

signal score_changed(new_score: int)
signal paused_changed(paused: bool)

var score: int = 0:
	set(value):
		score = max(0, value)
		score_changed.emit(score)

var is_paused: bool = false:
	set(value):
		is_paused = value
		get_tree().paused = is_paused
		paused_changed.emit(is_paused)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	print("[GameState] initialized")


func reset() -> void:
	score = 0
	is_paused = false


func toggle_pause() -> void:
	is_paused = not is_paused
