# UI and HUD overlay for Pulse Loom
class_name UIOverlay
extends Control

const PulseLoomConstants = preload("res://scripts/constants.gd")

var current_score: int = 0
var current_multiplier: int = 1
var current_overloads: int = 0
var current_time_left: float = 90.0
var current_stage: int = 1
var current_state: String = "ready"
var latest_result: Dictionary = {}

func _ready() -> void:
	var gm = get_parent()
	if gm:
		gm.score_updated.connect(_on_score_updated)
		gm.state_changed.connect(_on_state_changed)
		gm.run_ended.connect(_on_run_ended)
	queue_redraw()

func _on_score_updated(score: int, mult: int, ovl: int, time_left: float, stage: int) -> void:
	current_score = score
	current_multiplier = mult
	current_overloads = ovl
	current_time_left = time_left
	current_stage = stage
	queue_redraw()

func _on_state_changed(state: String) -> void:
	current_state = state
	queue_redraw()

func _on_run_ended(result: Dictionary) -> void:
	latest_result = result
	queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		_handle_touch_tap(event.position)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_handle_touch_tap(event.position)

func _handle_touch_tap(pos: Vector2) -> void:
	var gm = get_parent()
	if not gm:
		return
	var vp_size := get_viewport_rect().size
	if current_state == "ready":
		gm.start_run()
		return
	elif current_state == "ended":
		gm.reset_ready()
		return
	
	if pos.x < vp_size.x * 0.5:
		gm.rotate_core_left()
	else:
		gm.rotate_core_right()

func _draw() -> void:
	var vp_size := get_viewport_rect().size
	var font := ThemeDB.fallback_font
	
	var time_str := "TIME %04.1fS" % max(0.0, current_time_left)
	var stage_str := "STAGE %d/4" % current_stage
	var score_str := "%s" % str(current_score).lpad(7, "0")
	var mult_str := "×%d MULTIPLIER" % current_multiplier
	
	draw_string(font, Vector2(40, 50), score_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 32, Color(1, 1, 1, 0.95))
	draw_string(font, Vector2(40, 75), mult_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.0, 0.94, 1.0, 0.9))
	
	draw_string(font, Vector2(vp_size.x - 220, 50), time_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, Color(1, 1, 1, 0.95))
	draw_string(font, Vector2(vp_size.x - 220, 75), stage_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.69, 0.40, 1.0, 0.9))
	
	var ovl_label := "OVERLOAD"
	draw_string(font, Vector2(vp_size.x * 0.5 - 60, 45), ovl_label, HORIZONTAL_ALIGNMENT_CENTER, 120, 13, Color(0.7, 0.7, 0.8, 0.7))
	for i in range(PulseLoomConstants.MAX_OVERLOADS):
		var box_x: float = vp_size.x * 0.5 - 35.0 + (i * 26.0)
		var box_rect := Rect2(box_x, 52, 18, 12)
		if i < current_overloads:
			draw_rect(box_rect, Color(1.0, 0.2, 0.35, 0.95))
		else:
			draw_rect(box_rect, Color(0.15, 0.2, 0.3, 0.6), false, 1.5)
	
	var l_hint := "◀ ROTATE LEFT (A / ◄)"
	var r_hint := "ROTATE RIGHT (D / ►) ▶"
	draw_string(font, Vector2(40, vp_size.y - 30), l_hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.5, 0.6, 0.75, 0.6))
	draw_string(font, Vector2(vp_size.x - 240, vp_size.y - 30), r_hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.5, 0.6, 0.75, 0.6))
	
	if current_state == "ready":
		var box_w: float = 460.0
		var box_h: float = 180.0
		var rect := Rect2((vp_size.x - box_w) * 0.5, (vp_size.y - box_h) * 0.5 - 20, box_w, box_h)
		draw_rect(rect, Color(0.04, 0.07, 0.12, 0.92))
		draw_rect(rect, Color(0.0, 0.94, 1.0, 0.6), false, 1.5)
		
		draw_string(font, Vector2(rect.position.x, rect.position.y + 40), "PULSE LOOM", HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 24, Color.WHITE)
		draw_string(font, Vector2(rect.position.x, rect.position.y + 70), "Rotate the core conduit (A/D or ◄/►) to route pulses to matching glyphs", HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 13, Color(0.8, 0.9, 1.0, 0.8))
		draw_string(font, Vector2(rect.position.x, rect.position.y + 95), "3 Overloads trigger core failure · 90s score attack", HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 13, Color(1.0, 0.7, 0.3, 0.8))
		draw_string(font, Vector2(rect.position.x, rect.position.y + 145), "PRESS SPACE OR TAP TO INITIALIZE RUN", HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 15, Color(0.0, 0.94, 1.0, 0.95))
	
	elif current_state == "paused":
		var box_w: float = 360.0
		var box_h: float = 120.0
		var rect := Rect2((vp_size.x - box_w) * 0.5, (vp_size.y - box_h) * 0.5, box_w, box_h)
		draw_rect(rect, Color(0.04, 0.07, 0.12, 0.92))
		draw_rect(rect, Color(0.69, 0.40, 1.0, 0.6), false, 1.5)
		draw_string(font, Vector2(rect.position.x, rect.position.y + 45), "TRANSMISSION SUSPENDED", HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 20, Color.WHITE)
		draw_string(font, Vector2(rect.position.x, rect.position.y + 80), "PRESS P OR ESCAPE TO RESUME", HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 14, Color(0.8, 0.9, 1.0, 0.8))
	
	elif current_state == "ended":
		var outcome: String = str(latest_result.get("outcome", "complete"))
		var is_overload: bool = (outcome == "overload")
		var box_w: float = 480.0
		var box_h: float = 220.0
		var rect := Rect2((vp_size.x - box_w) * 0.5, (vp_size.y - box_h) * 0.5 - 20, box_w, box_h)
		draw_rect(rect, Color(0.04, 0.07, 0.12, 0.94))
		var border_col: Color = Color(1.0, 0.25, 0.35, 0.8) if is_overload else Color(0.0, 0.94, 1.0, 0.8)
		draw_rect(rect, border_col, false, 2.0)
		
		var title: String = "CRITICAL OVERLOAD" if is_overload else "TRANSMISSION COMPLETE"
		var medal_str: String = str(latest_result.get("medal", "none")).to_upper()
		
		draw_string(font, Vector2(rect.position.x, rect.position.y + 40), title, HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 22, border_col)
		draw_string(font, Vector2(rect.position.x, rect.position.y + 80), "FINAL SCORE: %s" % str(latest_result.get("score", 0)), HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 26, Color.WHITE)
		draw_string(font, Vector2(rect.position.x, rect.position.y + 115), "MEDAL: %s · MAX MULTIPLIER: ×%s" % [medal_str, str(latest_result.get("maxMultiplier", 1))], HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 14, Color(0.8, 0.9, 1.0, 0.9))
		draw_string(font, Vector2(rect.position.x, rect.position.y + 140), "ROUTES: %s · PERFECT: %s" % [str(latest_result.get("routesCompleted", 0)), str(latest_result.get("perfectRoutes", 0))], HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 13, Color(0.6, 0.75, 0.9, 0.8))
		draw_string(font, Vector2(rect.position.x, rect.position.y + 185), "PRESS SPACE OR TAP TO RETRY", HORIZONTAL_ALIGNMENT_CENTER, int(box_w), 15, Color(0.0, 0.94, 1.0, 0.95))
