# Crisp geometric arcade background for Pulse Loom
class_name ArcadeBackground
extends Node2D

func _draw() -> void:
	var vp_size := get_viewport_rect().size
	var center := vp_size * 0.5
	
	# Deep background
	draw_rect(Rect2(Vector2.ZERO, vp_size), Color(0.035, 0.045, 0.075, 1.0))
	
	# Coordinate grid lines
	var grid_step: float = 64.0
	var col_grid := Color(0.1, 0.14, 0.22, 0.25)
	
	var x: float = 0.0
	while x <= vp_size.x:
		draw_line(Vector2(x, 0), Vector2(x, vp_size.y), col_grid, 1.0)
		x += grid_step
	
	var y: float = 0.0
	while y <= vp_size.y:
		draw_line(Vector2(0, y), Vector2(vp_size.x, y), col_grid, 1.0)
		y += grid_step
	
	# Diagonal corner cross-hairs
	var ch_len: float = 24.0
	var col_ch := Color(0.2, 0.3, 0.45, 0.5)
	
	# Top Left
	draw_line(Vector2(20, 20), Vector2(20 + ch_len, 20), col_ch, 1.5)
	draw_line(Vector2(20, 20), Vector2(20, 20 + ch_len), col_ch, 1.5)
	
	# Top Right
	draw_line(Vector2(vp_size.x - 20, 20), Vector2(vp_size.x - 20 - ch_len, 20), col_ch, 1.5)
	draw_line(Vector2(vp_size.x - 20, 20), Vector2(vp_size.x - 20, 20 + ch_len), col_ch, 1.5)
	
	# Bottom Left
	draw_line(Vector2(20, vp_size.y - 20), Vector2(20 + ch_len, vp_size.y - 20), col_ch, 1.5)
	draw_line(Vector2(20, vp_size.y - 20), Vector2(20, vp_size.y - 20 - ch_len), col_ch, 1.5)
	
	# Bottom Right
	draw_line(Vector2(vp_size.x - 20, vp_size.y - 20), Vector2(vp_size.x - 20 - ch_len, vp_size.y - 20), col_ch, 1.5)
	draw_line(Vector2(vp_size.x - 20, vp_size.y - 20), Vector2(vp_size.x - 20, vp_size.y - 20 - ch_len), col_ch, 1.5)
