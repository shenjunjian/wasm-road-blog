extends Node2D
## 主场景：装配 Player + UI
##
## 通过 Inspector 给 UI 子节点的 @export 字段拖入 Player，
## 或者在 _ready 里代码绑定。

@onready var player: CharacterBody2D = $Player
@onready var health_bar: ProgressBar = $UI/HealthBar
@onready var game_over_label: Label = $UI/GameOverLabel
@onready var damage_zone: Area2D = $DamageZone


func _ready() -> void:
	# 代码绑定 @export 引用（也可以在 Inspector 拖入）
	health_bar.player = player
	game_over_label.player = player

	# 演示：damage_zone 每秒主动调用 player.take_damage
	_damage_loop()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key: int = (event as InputEventKey).keycode
		match key:
			KEY_SPACE: GameState.score += 10   # 测试：加分
			KEY_P:     GameState.toggle_pause()


func _damage_loop() -> void:
	# 异步循环：每 2 秒让 player 受伤 10 点（演示信号触发 UI 更新）
	while is_instance_valid(player):
		await get_tree().create_timer(2.0).timeout
		if not is_instance_valid(player):
			break
		player.take_damage(10)
