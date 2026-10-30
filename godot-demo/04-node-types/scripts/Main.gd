extends Node2D
## 第 04 章 demo：把所有重要节点各挂一个并演示
##
## 对应博客第 04 章第 9 节。
##
## 演示：
##   - Sprite2D：modulate 改变颜色
##   - AnimatedSprite2D：自动播放 "default" 动画（单帧循环）
##   - Polygon2D：三角形顶点数组
##   - Line2D：实时绘制正弦曲线（_process 里每帧重算 points）
##   - Label：静态文本
##   - Timer：每秒触发一次 timeout
##   - AudioStreamPlayer：每秒播放 beep（运行时合成的 440 Hz 正弦波）
##   - Tween：无限循环弹跳动画
##   - Node：纯逻辑容器（Tween_Bouncer）

@onready var spinner: AnimatedSprite2D = $AnimatedSprite2D_Spinner
@onready var beep: AudioStreamPlayer = $AudioStreamPlayer_Beep
@onready var bouncer: Polygon2D = $Tween_Bouncer/Polygon2D_Bouncer
@onready var tick: Timer = $Timer_Tick

var _elapsed: float = 0.0


func _ready() -> void:
	# 启动 AnimatedSprite2D 播放
	spinner.play("default")

	# Timer 触发时打印 + 播放 beep
	tick.timeout.connect(_on_tick)

	# 运行时合成一个 0.2 秒 440 Hz 的正弦波 beep
	beep.stream = _make_beep(440.0, 0.2)

	# 创建无限循环的 Tween，让三角形在 y=450 与 y=550 之间弹跳
	var t := create_tween().set_loops()
	t.tween_property(bouncer, "position:y", 450.0, 0.5)\
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t.tween_property(bouncer, "position:y", 550.0, 0.5)\
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _process(delta: float) -> void:
	_elapsed += delta

	# 每帧重算 Line2D 的点，画一条会波动的正弦曲线
	var pts := PackedVector2Array()
	for i in range(60):
		var x: float = 100.0 + i * 20.0
		var y: float = 350.0 + sin(_elapsed * 4.0 + i * 0.3) * 30.0
		pts.append(Vector2(x, y))
	$Line2D_Trail.points = pts


func _on_tick() -> void:
	print("timer tick at ", Time.get_ticks_msec(), " ms")
	beep.play()


## 运行时合成一段 N 秒 H Hz 的正弦波作为 AudioStreamWAV
func _make_beep(freq: float, duration: float) -> AudioStreamWAV:
	var wav := AudioStreamWAV.new()
	wav.mix_rate = 44100
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.stereo = false

	var sample_count: int = int(44100 * duration)
	var data := PackedByteArray()
	data.resize(sample_count * 2)

	for i in range(sample_count):
		var t: float = float(i) / 44100.0
		# 振幅随时间衰减（避免咔嚓声）
		var env: float = 1.0 - t / duration
		var v: float = sin(2.0 * PI * freq * t) * 0.3 * env
		var sample: int = clampi(int(v * 32767.0), -32768, 32767)
		data[i * 2] = sample & 0xff
		data[i * 2 + 1] = (sample >> 8) & 0xff

	wav.data = data
	return wav