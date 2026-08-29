# Signal pulse traveling along a radial lane in Pulse Loom
class_name SignalPulse
extends Node2D

const PulseLoomConstants = preload("res://scripts/constants.gd")

var source_lane: int = 0
var target_lane: int = 0
var distance: float = PulseLoomConstants.SPAWN_RADIUS
var speed: float = 140.0
var active: bool = true
var resolved: bool = false

var reduced_motion: bool = false
var glow_timer: float = 0.0

func setup(src: int, tgt: int, spd: float, reduced_mot: bool = false) -> void:
	source_lane = src
	target_lane = tgt
	speed = spd
	distance = PulseLoomConstants.SPAWN_RADIUS
	reduced_motion = reduced_mot
	active = true
	resolved = false
	update_position()

func update_position() -> void:
	var angle: float = PulseLoomConstants.get_lane_angle(source_lane)
	position = Vector2.RIGHT.rotated(angle) * distance
	queue_redraw()

func advance(delta: float) -> void:
	if not active or resolved:
		return
	distance -= speed * delta
	glow_timer += delta
	update_position()

func _draw() -> void:
	if not active:
		return
	
	var tgt_color: Color = PulseLoomConstants.LANE_COLORS[target_lane]
	var size: float = 16.0
	
	# Trail line toward spawn origin
	if not reduced_motion:
		var angle: float = PulseLoomConstants.get_lane_angle(source_lane)
		var trail_len: float = min(40.0, PulseLoomConstants.SPAWN_RADIUS - distance)
		var trail_vec := Vector2.RIGHT.rotated(angle) * trail_len
		draw_line(Vector2.ZERO, trail_vec, Color(tgt_color.r, tgt_color.g, tgt_color.b, 0.35), 4.0)
	
	# Outer token diamond / badge
	var badge := PackedVector2Array([
		Vector2(0, -size),
		Vector2(size, 0),
		Vector2(0, size),
		Vector2(-size, 0)
	])
	draw_colored_polygon(badge, Color(0.08, 0.12, 0.2, 0.95))
	draw_polyline(PackedVector2Array([
		Vector2(0, -size),
		Vector2(size, 0),
		Vector2(0, size),
		Vector2(-size, 0),
		Vector2(0, -size)
	]), tgt_color, 2.5)
	
	# Inner Glyph Representation (Crisp non-color dependent geometry)
	draw_glyph(target_lane, size * 0.55, Color.WHITE)

func draw_glyph(glyph_idx: int, radius: float, color: Color) -> void:
	match glyph_idx:
		PulseLoomConstants.GlyphType.HEXAGON:
			var pts: PackedVector2Array = []
			for i in range(7):
				var a := i * (TAU / 6.0)
				pts.append(Vector2(cos(a), sin(a)) * radius)
			draw_polyline(pts, color, 1.8)
		
		PulseLoomConstants.GlyphType.TRIANGLE:
			var pts: PackedVector2Array = [
				Vector2(0, -radius),
				Vector2(radius * 0.866, radius * 0.5),
				Vector2(-radius * 0.866, radius * 0.5),
				Vector2(0, -radius)
			]
			draw_polyline(pts, color, 1.8)
		
		PulseLoomConstants.GlyphType.DIAMOND:
			var pts: PackedVector2Array = [
				Vector2(0, -radius),
				Vector2(radius * 0.7, 0),
				Vector2(0, radius),
				Vector2(-radius * 0.7, 0),
				Vector2(0, -radius)
			]
			draw_polyline(pts, color, 1.8)
		
		PulseLoomConstants.GlyphType.SQUARE:
			var r: float = radius * 0.7
			var pts: PackedVector2Array = [
				Vector2(-r, -r),
				Vector2(r, -r),
				Vector2(r, r),
				Vector2(-r, r),
				Vector2(-r, -r)
			]
			draw_polyline(pts, color, 1.8)
		
		PulseLoomConstants.GlyphType.CIRCLE:
			draw_arc(Vector2.ZERO, radius * 0.75, 0, TAU, 16, color, 1.8)
		
		PulseLoomConstants.GlyphType.CROSS:
			var r: float = radius * 0.65
			draw_line(Vector2(-r, -r), Vector2(r, r), color, 2.0)
			draw_line(Vector2(-r, r), Vector2(r, -r), color, 2.0)
