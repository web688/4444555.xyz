# 6 Radial lanes and terminal glyph displays for Pulse Loom
class_name RadarLanes
extends Node2D

const PulseLoomConstants = preload("res://scripts/constants.gd")
const PulseLoomRouting = preload("res://scripts/routing.gd")

var lane_flash_timers: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
var lane_flash_types: Array[String] = ["success", "success", "success", "success", "success", "success"]

var active_source_lane: int = -1
var active_target_lane: int = -1
var active_rotor_step: int = 0
var active_pulse_dist: float = 0.0
var anim_timer: float = 0.0

func _ready() -> void:
	queue_redraw()

func set_preview_state(src: int, tgt: int, step: int, dist: float) -> void:
	var changed: bool = (active_source_lane != src or active_target_lane != tgt or active_rotor_step != step or absf(active_pulse_dist - dist) > 1.0)
	active_source_lane = src
	active_target_lane = tgt
	active_rotor_step = step
	active_pulse_dist = dist
	if changed:
		queue_redraw()

func trigger_lane_flash(lane: int, flash_type: String = "success", duration: float = 0.35) -> void:
	if lane >= 0 and lane < PulseLoomConstants.NUM_LANES:
		lane_flash_timers[lane] = duration
		lane_flash_types[lane] = flash_type
		queue_redraw()

func _process(delta: float) -> void:
	anim_timer += delta
	var needs_redraw := false
	for i in range(PulseLoomConstants.NUM_LANES):
		if lane_flash_timers[i] > 0.0:
			lane_flash_timers[i] -= delta
			needs_redraw = true
	
	if active_source_lane >= 0 or needs_redraw:
		queue_redraw()

func _draw() -> void:
	var center := Vector2.ZERO
	var r_spawn: float = PulseLoomConstants.SPAWN_RADIUS
	var r_core: float = PulseLoomConstants.CORE_RADIUS
	
	# Concentric reference range rings
	draw_arc(center, 140.0, 0, TAU, 48, Color(0.12, 0.18, 0.28, 0.4), 1.0)
	draw_arc(center, 220.0, 0, TAU, 48, Color(0.12, 0.18, 0.28, 0.4), 1.0)
	draw_arc(center, r_spawn, 0, TAU, 64, Color(0.18, 0.26, 0.38, 0.6), 1.5)
	
	# Compute active preview variables if pulse is present
	var routed_lane := -1
	var is_aligned := false
	if active_source_lane >= 0:
		routed_lane = PulseLoomRouting.get_routed_lane(active_source_lane, active_rotor_step)
		is_aligned = PulseLoomRouting.is_aligned(active_source_lane, active_target_lane, active_rotor_step)
	
	# Draw 6 Radial Lanes
	for i in range(PulseLoomConstants.NUM_LANES):
		var angle: float = PulseLoomConstants.get_lane_angle(i)
		var dir := Vector2.RIGHT.rotated(angle)
		var p_start := center + dir * r_core
		var p_end := center + dir * r_spawn
		var col: Color = PulseLoomConstants.LANE_COLORS[i]
		
		# Base lane line
		draw_line(p_start, p_end, Color(col.r, col.g, col.b, 0.22), 1.5)
		
		# Outbound Preview Beam along currently routed lane
		if routed_lane == i:
			if is_aligned:
				# Aligned Success Beam
				var beam_glow := Color(0.0, 1.0, 0.7, 0.65)
				var beam_core := Color(1.0, 1.0, 1.0, 0.95)
				draw_line(p_start, p_end, beam_glow, 7.0)
				draw_line(p_start, p_end, beam_core, 2.5)
				
				# Outward-flowing directional indicator chevrons along beam
				var num_chevrons := 4
				for c in range(num_chevrons):
					var phase := fmod(anim_timer * 2.5 + float(c) / float(num_chevrons), 1.0)
					var ch_pos := p_start + (p_end - p_start) * phase
					var norm := Vector2(-dir.y, dir.x)
					var tip := ch_pos + dir * 6.0
					var left := ch_pos - dir * 4.0 + norm * 5.0
					var right := ch_pos - dir * 4.0 - norm * 5.0
					draw_polyline(PackedVector2Array([left, tip, right]), Color(1.0, 1.0, 1.0, 0.9), 2.0)
			else:
				# Misaligned Warning Preview Guide
				var warn_col := Color(1.0, 0.7, 0.2, 0.55)
				draw_line(p_start, p_end, warn_col, 4.0)
				draw_line(p_start, p_end, Color(1.0, 0.9, 0.6, 0.8), 1.5)
		
		# Flash beam if active
		if lane_flash_timers[i] > 0.0:
			var alpha: float = min(1.0, lane_flash_timers[i] * 3.0)
			var flash_is_success := (lane_flash_types[i] == "success")
			var f_col := Color(0.0, 1.0, 0.7) if flash_is_success else Color(1.0, 0.2, 0.3)
			draw_line(p_start, p_end, Color(f_col.r, f_col.g, f_col.b, alpha * 0.85), 6.0)
			draw_line(p_start, p_end, Color(1.0, 1.0, 1.0, alpha * 0.95), 2.5)
		
		# Outer Terminal Station Badge
		var term_pos := center + dir * (r_spawn + 24.0)
		var term_col := col
		draw_circle(term_pos, 16.0, Color(0.05, 0.09, 0.15, 0.96))
		draw_arc(term_pos, 16.0, 0, TAU, 24, term_col, 2.0)
		
		# Draw terminal glyph inside badge
		draw_terminal_glyph(term_pos, i, 9.0, Color.WHITE)
		
		# Target Terminal Reticle & Status Indicators
		if active_target_lane == i:
			if is_aligned and routed_lane == i:
				# Double locked circle in bright emerald/cyan
				var lock_pulse := 1.0 + 0.15 * sin(anim_timer * 8.0)
				draw_arc(term_pos, 22.0 * lock_pulse, 0, TAU, 28, Color(0.0, 1.0, 0.7, 0.95), 2.5)
				draw_arc(term_pos, 18.0, 0, TAU, 24, Color(1.0, 1.0, 1.0, 0.9), 1.5)
				# 4 corner bracket locks
				var bk_r := 25.0
				draw_rect(Rect2(term_pos.x - bk_r, term_pos.y - bk_r, bk_r * 2.0, bk_r * 2.0), Color(0.0, 1.0, 0.7, 0.4), false, 1.5)
			else:
				# Target Destination Marker (where pulse needs to go)
				var tgt_pulse := 1.0 + 0.1 * sin(anim_timer * 6.0)
				var ret_r := 23.0 * tgt_pulse
				# 4 Target Reticle Corner Brackets
				var b_len := 7.0
				var col_tgt := Color(1.0, 0.85, 0.3, 0.95)
				# Top-Left
				draw_polyline(PackedVector2Array([term_pos + Vector2(-ret_r, -ret_r + b_len), term_pos + Vector2(-ret_r, -ret_r), term_pos + Vector2(-ret_r + b_len, -ret_r)]), col_tgt, 2.0)
				# Top-Right
				draw_polyline(PackedVector2Array([term_pos + Vector2(ret_r - b_len, -ret_r), term_pos + Vector2(ret_r, -ret_r), term_pos + Vector2(ret_r, -ret_r + b_len)]), col_tgt, 2.0)
				# Bottom-Left
				draw_polyline(PackedVector2Array([term_pos + Vector2(-ret_r, ret_r - b_len), term_pos + Vector2(-ret_r, ret_r), term_pos + Vector2(-ret_r + b_len, ret_r)]), col_tgt, 2.0)
				# Bottom-Right
				draw_polyline(PackedVector2Array([term_pos + Vector2(ret_r - b_len, ret_r), term_pos + Vector2(ret_r, ret_r), term_pos + Vector2(ret_r, ret_r - b_len)]), col_tgt, 2.0)
		elif not is_aligned and routed_lane == i:
			# Current Misaligned Route Terminal Marker
			var exit_col := Color(1.0, 0.65, 0.2, 0.85)
			draw_arc(term_pos, 21.0, 0, TAU, 24, exit_col, 1.8)
			draw_circle(term_pos + dir * 25.0, 3.5, exit_col)

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
