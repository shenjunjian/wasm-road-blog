extends Node3D
## 第 03 章 demo：下半屏 3D 子场景
##
## 这个脚本演示 Node3D 体系：MeshInstance3D + 3D 世界单位 + GPU 自动深度测试。

@export var rot_speed: float = 1.2  # 弧度/秒


func _process(delta: float) -> void:
	# 3D 节点：rotate_y 绕 Y 轴旋转
	rotate_y(rot_speed * delta)
