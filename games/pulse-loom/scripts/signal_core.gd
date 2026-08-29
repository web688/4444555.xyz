# Central signal core rotor for Pulse Loom
class_name SignalCore
extends Node2D

const PulseLoomConstants = preload("res://scripts/constants.gd")

signal rotation_changed(new_step: int)

var current_step: int = 0:
	set(val):
		var old_val := current_step
		current_step = posmod(val, PulseLoomConstants.NUM_LANES)
		if old_val != current_step:
			rotation_changed.emit(current_step)

var target_angle: float = 0.0
var visual_angle: float = 0.0
var reduced_motion: bool = false

var flash_timer: float = 0.0
var flash_color: Color = Color.WHITE

func _ready() -> void:
	target_angle = current_step * PulseLoomConstants.LANE_ANGLE_STEP
	visual_angle = target_angle

func rotate_left() -> void:
	current_step -= 1
	target_angle = current_step * PulseLoomConstants.LANE_ANGLE_STEP
	if reduced_motion:
		visual_angle = target_angle
	queue_redraw()

func rotate_right() -> void:
	current_step += 1
	target_angle = current_step * PulseLoomConstants.LANE_ANGLE_STEP
	if reduced_motion:
		visual_angle = target_angle
	queue_redraw()

func set_step(step: int) -> void:
	current_step = step
	target_angle = current_step * PulseLoomConstants.LANE_ANGLE_STEP
	visual_angle = target_angle
	queue_redraw()

func trigger_flash(color: Color, duration: float = 0.25) -> void:
	flash_color = color
	flash_timer = duration
	queue_redraw()

func _process(delta: float) -> void:
	if flash_timer > 0.0:
		flash_timer -= delta
		queue_redraw()
	
	if not reduced_motion:
		var diff := target_angle - visual_angle
		if abs(diff) > 0.001:
			visual_angle = lerp(visual_angle, target_angle, delta * 24.0)
			queue_redraw()
		else:
			visual_angle = target_angle

func _draw() -> void:
	var center := Vector2.ZERO
	var core_r: float = PulseLoomConstants.CORE_RADIUS
	
	# Background disc
	draw_circle(center, core_r, Color(0.05, 0.08, 0.14, 0.95))
	
	# Outer perimeter ring
	draw_arc(center, core_r, 0, TAU, 64, Color(0.2, 0.3, 0.45, 0.8), 2.0)
	
	# Flash effect if active
	if flash_timer > 0.0:
		var alpha: float = min(1.0, flash_timer * 4.0)
		draw_circle(center, core_r - 2.0, Color(flash_color.r, flash_color.g, flash_color.b, alpha * 0.4))
	
	# Draw 6 perimeter docking notches for the lanes
	for i in range(PulseLoomConstants.NUM_LANES):
		var angle: float = PulseLoomConstants.get_lane_angle(i)
		var notch_pos := center + Vector2.RIGHT.rotated(angle) * core_r
		draw_circle(notch_pos, 4.0, PulseLoomConstants.LANE_COLORS[i])
	
	# Draw rotating conduit assembly
	draw_set_transform(center, visual_angle, Vector2.ONE)
	
	# Conduit bridge track
	draw_circle(Vector2.ZERO, core_r * 0.65, Color(0.08, 0.13, 0.22, 0.9))
	draw_arc(Vector2.ZERO, core_r * 0.65, 0, TAU, 32, Color(0.3, 0.45, 0.65, 0.7), 1.5)
	
	# Primary conduit routing channel
	var p_in := Vector2.LEFT * (core_r - 4.0)
	var p_out := Vector2.RIGHT * (core_r - 4.0)
	
	# Conduit pipeline glow and line
	draw_line(p_in, p_out, Color(0.0, 0.94, 1.0, 0.4), 6.0)
	draw_line(p_in, p_out, Color(1.0, 1.0, 1.0, 0.95), 2.5)
	
	# Rotor intake pointer & exit nozzle
	draw_circle(p_in, 5.0, Color(0.0, 0.94, 1.0, 0.9))
	draw_polygon(
		PackedVector2Array([
			p_out + Vector2(6, 0),
			p_out + Vector2(-6, -6),
			p_out + Vector2(-6, 6)
		]),
		PackedColorArray([Color(0.0, 0.94, 1.0, 0.95), Color(0.0, 0.94, 1.0, 0.95), Color(0.0, 0.94, 1.0, 0.95)])
	)
	
	# Center nucleus jewel
	draw_circle(Vector2.ZERO, 10.0, Color(0.0, 0.94, 1.0, 0.8))
	draw_circle(Vector2.ZERO, 5.0, Color.WHITE)
	
	# Reset transform
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
