extends Area2D
## 第 02 章 demo：子弹
##
## 演示：
##   - Area2D：能接收信号但不参与物理碰撞阻挡
##   - queue_free()：当前帧结束后释放节点（不会与当前帧逻辑冲突）
##   - 出界销毁：用 position.y < -40 作为边界判断

@export var speed: float = 600.0


func _physics_process(delta: float) -> void:
	position.y -= speed * delta

	# 飞到屏幕外就释放，避免内存堆积
	if position.y < -40.0:
		queue_free()
