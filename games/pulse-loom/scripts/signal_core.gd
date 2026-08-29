# Central signal core rotor for Pulse Loom
class_name SignalCore
extends Node2D

const PulseLoomConstants = preload("res://scripts/constants.gd")
const PulseLoomRouting = preload("res://scripts/routing.gd")

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

# Active pulse preview properties
var active_source_lane: int = -1
var active_target_lane: int = -1
var active_pulse_dist: float = 0.0

func _ready() -> void:
	target_angle = current_step * PulseLoomConstants.LANE_ANGLE_STEP
	visual_angle = target_angle

func set_preview_pulse(src: int, tgt: int, dist: float) -> void:
	var changed: bool = (active_source_lane != src or active_target_lane != tgt or absf(active_pulse_dist - dist) > 1.0)
	active_source_lane = src
	active_target_lane = tgt
	active_pulse_dist = dist
	if changed:
		queue_redraw()

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
	draw_circle(center, core_r, Color(0.04, 0.07, 0.13, 0.96))
	
	# Outer perimeter ring
	draw_arc(center, core_r, 0, TAU, 64, Color(0.25, 0.35, 0.5, 0.8), 2.0)
	
	# Flash effect if active
	if flash_timer > 0.0:
		var alpha: float = min(1.0, flash_timer * 4.0)
		draw_circle(center, core_r - 2.0, Color(flash_color.r, flash_color.g, flash_color.b, alpha * 0.45))
	
	# Draw rotating rotor dial track
	draw_circle(center, core_r * 0.72, Color(0.07, 0.11, 0.19, 0.9))
	draw_arc(center, core_r * 0.72, 0, TAU, 36, Color(0.2, 0.32, 0.48, 0.5), 1.2)
	
	# 6 perimeter docking notches for the lanes
	for i in range(PulseLoomConstants.NUM_LANES):
		var angle: float = PulseLoomConstants.get_lane_angle(i)
		var notch_pos := center + Vector2.RIGHT.rotated(angle) * core_r
		var notch_col: Color = PulseLoomConstants.LANE_COLORS[i]
		draw_circle(notch_pos, 4.0, notch_col)
	
	# Draw active through-core route conduit or neutral rotor
	if active_source_lane >= 0:
		var routed_lane := PulseLoomRouting.get_routed_lane(active_source_lane, current_step)
		var is_aligned := PulseLoomRouting.is_aligned(active_source_lane, active_target_lane, current_step)
		
		var in_angle := PulseLoomConstants.get_lane_angle(active_source_lane)
		var out_angle := PulseLoomConstants.get_lane_angle(routed_lane)
		
		var p_in := center + Vector2.RIGHT.rotated(in_angle) * (core_r - 4.0)
		var p_out := center + Vector2.RIGHT.rotated(out_angle) * (core_r - 4.0)
		var dir_out := Vector2.RIGHT.rotated(out_angle)
		
		var glow_col := Color(0.0, 1.0, 0.7, 0.7) if is_aligned else Color(1.0, 0.7, 0.2, 0.5)
		var core_col := Color(1.0, 1.0, 1.0, 0.98) if is_aligned else Color(1.0, 0.9, 0.7, 0.9)
		var arrow_col := Color(0.0, 1.0, 0.7, 0.98) if is_aligned else Color(1.0, 0.7, 0.2, 0.95)
		
		# Conduit path: in -> center nucleus -> out
		if active_source_lane == routed_lane:
			# Straight line through center or loop
			draw_line(p_in, center, glow_col, 7.0)
			draw_line(p_in, center, core_col, 3.0)
			draw_line(center, p_out, glow_col, 7.0)
			draw_line(center, p_out, core_col, 3.0)
		else:
			draw_line(p_in, center, glow_col, 6.0)
			draw_line(p_in, center, core_col, 2.8)
			draw_line(center, p_out, glow_col, 6.0)
			draw_line(center, p_out, core_col, 2.8)
		
		# Inbound intake node
		draw_circle(p_in, 5.5, glow_col)
		draw_circle(p_in, 3.0, Color.WHITE)
		
		# Outbound directional nozzle / arrow
		var norm_out := Vector2(-dir_out.y, dir_out.x)
		var arrow_tip := p_out + dir_out * 4.0
		var arrow_left := p_out - dir_out * 6.0 + norm_out * 5.5
		var arrow_right := p_out - dir_out * 6.0 - norm_out * 5.5
		draw_colored_polygon(PackedVector2Array([arrow_tip, arrow_left, arrow_right]), arrow_col)
		
		# Center nucleus jewel
		var nuc_col := Color(0.0, 1.0, 0.7, 0.9) if is_aligned else Color(0.0, 0.94, 1.0, 0.85)
		draw_circle(center, 9.0, nuc_col)
		draw_circle(center, 4.5, Color.WHITE)
	else:
		# Idle neutral rotor bridge
		draw_set_transform(center, visual_angle, Vector2.ONE)
		var p_in := Vector2.LEFT * (core_r - 4.0)
		var p_out := Vector2.RIGHT * (core_r - 4.0)
		draw_line(p_in, p_out, Color(0.0, 0.94, 1.0, 0.35), 5.0)
		draw_line(p_in, p_out, Color(0.8, 0.95, 1.0, 0.9), 2.0)
		draw_circle(p_in, 4.5, Color(0.0, 0.94, 1.0, 0.8))
		draw_polygon(
			PackedVector2Array([p_out + Vector2(5, 0), p_out + Vector2(-5, -5), p_out + Vector2(-5, 5)]),
			PackedColorArray([Color(0.0, 0.94, 1.0, 0.9), Color(0.0, 0.94, 1.0, 0.9), Color(0.0, 0.94, 1.0, 0.9)])
		)
		draw_circle(Vector2.ZERO, 8.0, Color(0.0, 0.94, 1.0, 0.8))
		draw_circle(Vector2.ZERO, 4.0, Color.WHITE)
		draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
