# 6 Radial lanes and terminal glyph displays for Pulse Loom
class_name RadarLanes
extends Node2D

const PulseLoomConstants = preload("res://scripts/constants.gd")

var lane_flash_timers: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

func _ready() -> void:
	queue_redraw()

func trigger_lane_flash(lane: int, duration: float = 0.35) -> void:
	if lane >= 0 and lane < PulseLoomConstants.NUM_LANES:
		lane_flash_timers[lane] = duration
		queue_redraw()

func _process(delta: float) -> void:
	var needs_redraw := false
	for i in range(PulseLoomConstants.NUM_LANES):
		if lane_flash_timers[i] > 0.0:
			lane_flash_timers[i] -= delta
			needs_redraw = true
	if needs_redraw:
		queue_redraw()

func _draw() -> void:
	var center := Vector2.ZERO
	var r_spawn: float = PulseLoomConstants.SPAWN_RADIUS
	var r_core: float = PulseLoomConstants.CORE_RADIUS
	
	# Concentric reference range rings
	draw_arc(center, 140.0, 0, TAU, 48, Color(0.12, 0.18, 0.28, 0.4), 1.0)
	draw_arc(center, 220.0, 0, TAU, 48, Color(0.12, 0.18, 0.28, 0.4), 1.0)
	draw_arc(center, r_spawn, 0, TAU, 64, Color(0.18, 0.26, 0.38, 0.6), 1.5)
	
	# Draw 6 Radial Lanes
	for i in range(PulseLoomConstants.NUM_LANES):
		var angle: float = PulseLoomConstants.get_lane_angle(i)
		var dir := Vector2.RIGHT.rotated(angle)
		var p_start := center + dir * r_core
		var p_end := center + dir * r_spawn
		var col: Color = PulseLoomConstants.LANE_COLORS[i]
		
		# Base lane line
		draw_line(p_start, p_end, Color(col.r, col.g, col.b, 0.25), 1.5)
		
		# Flash beam if active
		if lane_flash_timers[i] > 0.0:
			var alpha: float = min(1.0, lane_flash_timers[i] * 3.0)
			draw_line(p_start, p_end, Color(col.r, col.g, col.b, alpha * 0.8), 5.0)
			draw_line(p_start, p_end, Color(1.0, 1.0, 1.0, alpha * 0.9), 2.0)
		
		# Outer Terminal Station Badge
		var term_pos := center + dir * (r_spawn + 24.0)
		var term_col := col
		draw_circle(term_pos, 16.0, Color(0.06, 0.1, 0.16, 0.95))
		draw_arc(term_pos, 16.0, 0, TAU, 24, term_col, 2.0)
		
		# Terminal Glyph symbol
		draw_terminal_glyph(term_pos, i, 9.0, Color.WHITE)

func draw_terminal_glyph(pos: Vector2, glyph_idx: int, radius: float, color: Color) -> void:
	match glyph_idx:
		PulseLoomConstants.GlyphType.HEXAGON:
			var pts: PackedVector2Array = []
			for i in range(7):
				var a := i * (TAU / 6.0)
				pts.append(pos + Vector2(cos(a), sin(a)) * radius)
			draw_polyline(pts, color, 1.8)
		
		PulseLoomConstants.GlyphType.TRIANGLE:
			var pts: PackedVector2Array = [
				pos + Vector2(0, -radius),
				pos + Vector2(radius * 0.866, radius * 0.5),
				pos + Vector2(-radius * 0.866, radius * 0.5),
				pos + Vector2(0, -radius)
			]
			draw_polyline(pts, color, 1.8)
		
		PulseLoomConstants.GlyphType.DIAMOND:
			var pts: PackedVector2Array = [
				pos + Vector2(0, -radius),
				pos + Vector2(radius * 0.7, 0),
				pos + Vector2(0, radius),
				pos + Vector2(-radius * 0.7, 0),
				pos + Vector2(0, -radius)
			]
			draw_polyline(pts, color, 1.8)
		
		PulseLoomConstants.GlyphType.SQUARE:
			var r: float = radius * 0.7
			var pts: PackedVector2Array = [
				pos + Vector2(-r, -r),
				pos + Vector2(r, -r),
				pos + Vector2(r, r),
				pos + Vector2(-r, r),
				pos + Vector2(-r, -r)
			]
			draw_polyline(pts, color, 1.8)
		
		PulseLoomConstants.GlyphType.CIRCLE:
			draw_arc(pos, radius * 0.75, 0, TAU, 16, color, 1.8)
		
		PulseLoomConstants.GlyphType.CROSS:
			var r: float = radius * 0.65
			draw_line(pos + Vector2(-r, -r), pos + Vector2(r, r), color, 2.0)
			draw_line(pos + Vector2(-r, r), pos + Vector2(r, -r), color, 2.0)
