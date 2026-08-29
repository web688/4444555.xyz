# Core game manager and state controller for Pulse Loom
class_name GameManager
extends Node2D

const PulseLoomConstants = preload("res://scripts/constants.gd")
const SignalCore = preload("res://scripts/signal_core.gd")
const RadarLanes = preload("res://scripts/radar_lanes.gd")
const SignalPulse = preload("res://scripts/pulse.gd")
const PulseAudio = preload("res://scripts/audio_synth.gd")
const WebBridge = preload("res://scripts/web_bridge.gd")

signal state_changed(new_state: String)
signal score_updated(score: int, multiplier: int, overloads: int, time_left: float, stage: int)
signal run_ended(result: Dictionary)

enum State { READY, RUNNING, PAUSED, ENDED }

var current_state: State = State.READY
var ticket_id: String = ""
var seed_val: int = 1337

var time_remaining: float = PulseLoomConstants.TOTAL_RUN_SECONDS
var score: int = 0
var multiplier: int = 1
var max_multiplier: int = 1
var streak: int = 0
var overloads: int = 0
var routes_completed: int = 0
var perfect_routes: int = 0
var current_stage: int = 1

var spawn_timer: float = 0.0
var active_pulses: Array[SignalPulse] = []

# Deterministic PRNG initialized immediately
var rng: RandomNumberGenerator = RandomNumberGenerator.new()

@onready var signal_core: SignalCore = $SignalCore
@onready var radar_lanes: RadarLanes = $RadarLanes
@onready var audio_synth: PulseAudio = $AudioSynth
@onready var web_bridge: WebBridge = $WebBridge
@onready var pulse_container: Node2D = $PulseContainer
@onready var ui_overlay: CanvasItem = $UIOverlay

var telemetry_timer: float = 0.0
var reduced_motion: bool = false
var muted: bool = false

func _ensure_nodes() -> void:
	if not signal_core:
		signal_core = get_node_or_null("SignalCore") as SignalCore
	if not radar_lanes:
		radar_lanes = get_node_or_null("RadarLanes") as RadarLanes
	if not audio_synth:
		audio_synth = get_node_or_null("AudioSynth") as PulseAudio
	if not web_bridge:
		web_bridge = get_node_or_null("WebBridge") as WebBridge
	if not pulse_container:
		pulse_container = get_node_or_null("PulseContainer") as Node2D
	if not ui_overlay:
		ui_overlay = get_node_or_null("UIOverlay") as CanvasItem

func _ready() -> void:
	_ensure_nodes()
	rng.seed = seed_val
	
	if web_bridge:
		web_bridge.host_start_requested.connect(_on_host_start)
		web_bridge.host_pause_requested.connect(pause_game)
		web_bridge.host_resume_requested.connect(resume_game)
		web_bridge.host_restart_requested.connect(_on_host_restart)
		web_bridge.host_settings_changed.connect(_on_host_settings)
	
	set_state(State.READY)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("rotate_left"):
		rotate_core_left()
	elif event.is_action_pressed("rotate_right"):
		rotate_core_right()
	elif event.is_action_pressed("pause"):
		toggle_pause()

func rotate_core_left() -> void:
	_ensure_nodes()
	if current_state == State.RUNNING or current_state == State.READY:
		if signal_core:
			signal_core.rotate_left()
		if audio_synth:
			audio_synth.play_rotate()

func rotate_core_right() -> void:
	_ensure_nodes()
	if current_state == State.RUNNING or current_state == State.READY:
		if signal_core:
			signal_core.rotate_right()
		if audio_synth:
			audio_synth.play_rotate()

func toggle_pause() -> void:
	if current_state == State.RUNNING:
		pause_game()
	elif current_state == State.PAUSED:
		resume_game()

static func parse_iso_datetime(iso_str: String) -> float:
	if iso_str.is_empty():
		return -1.0
	var clean := iso_str.strip_edges()
	if clean.ends_with("Z") or clean.ends_with("z"):
		clean = clean.substr(0, clean.length() - 1)
	var millis := 0.0
	var dot_idx := clean.find(".")
	if dot_idx != -1:
		var frac_str := clean.substr(dot_idx)
		clean = clean.substr(0, dot_idx)
		if frac_str.length() <= 1:
			return -1.0
		var frac_digits := frac_str.substr(1)
		if not frac_digits.is_valid_int():
			return -1.0
		millis = frac_str.to_float()
	var dt_dict := Time.get_datetime_dict_from_datetime_string(clean, false)
	if dt_dict.is_empty():
		return -1.0
	if int(dt_dict.get("year", 0)) <= 0 or int(dt_dict.get("month", 0)) <= 0 or int(dt_dict.get("day", 0)) <= 0:
		return -1.0
	var base_unix := Time.get_unix_time_from_datetime_dict(dt_dict)
	if base_unix <= 0:
		return -1.0
	return float(base_unix) + millis

func is_valid_ticket(ticket: Dictionary) -> bool:
	if ticket.is_empty():
		return false
	
	const REQUIRED_FIELDS := [
		"id",
		"gameId",
		"gameVersion",
		"issuedAt",
		"expiresAt",
		"seed",
		"ruleset",
		"signature"
	]
	
	for field in REQUIRED_FIELDS:
		if not ticket.has(field):
			return false
		var val = ticket[field]
		if typeof(val) != TYPE_STRING:
			return false
		if (val as String).is_empty():
			return false
	
	var t_id: String = ticket["id"]
	if not t_id.begins_with("run-pl-"):
		return false
	
	if ticket["gameId"] != "pulse-loom":
		return false
	
	if ticket["gameVersion"] != "0.1.0":
		return false
	
	if ticket["ruleset"] != "conduit-v1":
		return false
	
	if ticket["signature"] != "local-unverified":
		return false
	
	var issued_unix := parse_iso_datetime(ticket["issuedAt"])
	var expires_unix := parse_iso_datetime(ticket["expiresAt"])
	
	if issued_unix <= 0.0 or expires_unix <= 0.0:
		return false
	
	if expires_unix <= issued_unix:
		return false
	
	var current_system_time := Time.get_unix_time_from_system()
	if expires_unix <= current_system_time:
		return false
	
	return true

func start_run(ticket: Dictionary = {}) -> void:
	_ensure_nodes()
	if not is_valid_ticket(ticket):
		push_error("[Pulse Loom] Refusing start_run: missing, invalid, or expired RunTicket.")
		return
	ticket_id = ticket["id"]
	var seed_str: String = ticket["seed"]
	seed_val = hash(seed_str)
	
	rng.seed = seed_val
	
	time_remaining = PulseLoomConstants.TOTAL_RUN_SECONDS
	score = 0
	multiplier = 1
	max_multiplier = 1
	streak = 0
	overloads = 0
	routes_completed = 0
	perfect_routes = 0
	current_stage = 1
	spawn_timer = 1.0
	
	_clear_all_pulses()
	if signal_core:
		signal_core.set_step(0)
	
	set_state(State.RUNNING)
	_emit_score_update()

func pause_game() -> void:
	if current_state == State.RUNNING:
		set_state(State.PAUSED)

func resume_game() -> void:
	if current_state == State.PAUSED:
		set_state(State.RUNNING)

func reset_ready() -> void:
	_clear_all_pulses()
	time_remaining = PulseLoomConstants.TOTAL_RUN_SECONDS
	score = 0
	multiplier = 1
	streak = 0
	overloads = 0
	routes_completed = 0
	perfect_routes = 0
	current_stage = 1
	set_state(State.READY)
	_emit_score_update()

func set_state(new_state: State) -> void:
	current_state = new_state
	var state_name := "ready"
	match current_state:
		State.READY:
			state_name = "ready"
		State.RUNNING:
			state_name = "running"
		State.PAUSED:
			state_name = "paused"
		State.ENDED:
			state_name = "ended"
	state_changed.emit(state_name)
	if web_bridge:
		web_bridge.send_state_change(state_name)

func _on_host_start(ticket: Dictionary) -> void:
	start_run(ticket)

func _on_host_restart(ticket: Dictionary) -> void:
	start_run(ticket)

func _on_host_settings(settings: Dictionary) -> void:
	_ensure_nodes()
	if settings.has("muted") and typeof(settings["muted"]) == TYPE_BOOL:
		muted = settings["muted"]
		if audio_synth:
			audio_synth.set_muted(muted)
	if settings.has("reducedMotion") and typeof(settings["reducedMotion"]) == TYPE_BOOL:
		reduced_motion = settings["reducedMotion"]
		if signal_core:
			signal_core.reduced_motion = reduced_motion
		for p in active_pulses:
			p.reduced_motion = reduced_motion

func _process(delta: float) -> void:
	if current_state != State.RUNNING:
		return
	
	time_remaining -= delta
	if time_remaining <= 0.0:
		time_remaining = 0.0
		_complete_run("complete")
		return
	
	var elapsed := PulseLoomConstants.TOTAL_RUN_SECONDS - time_remaining
	var next_stage: int = 1
	if elapsed >= 75.0:
		next_stage = 4
	elif elapsed >= 50.0:
		next_stage = 3
	elif elapsed >= 25.0:
		next_stage = 2
	
	if next_stage != current_stage:
		current_stage = next_stage
		if audio_synth:
			audio_synth.play_stage_up()
	
	spawn_timer -= delta
	if spawn_timer <= 0.0:
		_spawn_pulse()
		spawn_timer = _get_spawn_interval()
	
	_update_pulses(delta)
	
	telemetry_timer += delta
	if telemetry_timer >= 0.1:
		telemetry_timer = 0.0
		_emit_telemetry()

func _get_spawn_interval() -> float:
	match current_stage:
		1:
			return rng.randf_range(2.2, 2.6)
		2:
			return rng.randf_range(1.6, 2.0)
		3:
			return rng.randf_range(1.2, 1.5)
		4:
			return rng.randf_range(0.85, 1.15)
		_:
			return 2.0

func _get_pulse_speed() -> float:
	match current_stage:
		1:
			return 130.0
		2:
			return 170.0
		3:
			return 210.0
		4:
			return 250.0
		_:
			return 140.0

func _spawn_pulse() -> void:
	_ensure_nodes()
	var src_lane := rng.randi_range(0, PulseLoomConstants.NUM_LANES - 1)
	var tgt_lane := rng.randi_range(0, PulseLoomConstants.NUM_LANES - 1)
	var spd := _get_pulse_speed()
	
	var pulse := SignalPulse.new()
	pulse.setup(src_lane, tgt_lane, spd, reduced_motion)
	if pulse_container:
		pulse_container.add_child(pulse)
	active_pulses.append(pulse)

func _update_pulses(delta: float) -> void:
	var to_remove: Array[SignalPulse] = []
	
	for pulse in active_pulses:
		if not pulse.active or pulse.resolved:
			to_remove.append(pulse)
			continue
		
		pulse.advance(delta)
		
		if pulse.distance <= PulseLoomConstants.CORE_RADIUS:
			_resolve_pulse(pulse)
			to_remove.append(pulse)
	
	for pulse in to_remove:
		active_pulses.erase(pulse)
		pulse.queue_free()

func _resolve_pulse(pulse: SignalPulse) -> void:
	_ensure_nodes()
	pulse.resolved = true
	
	var rotor_step: int = signal_core.current_step if signal_core else 0
	var routed_lane := (pulse.source_lane + rotor_step) % PulseLoomConstants.NUM_LANES
	
	if routed_lane == pulse.target_lane:
		streak += 1
		multiplier = min(10, 1 + int(streak / 2))
		if multiplier > max_multiplier:
			max_multiplier = multiplier
		
		var pts := 100 * multiplier
		var perfect := (pulse.distance >= PulseLoomConstants.CORE_RADIUS - 10.0)
		if perfect:
			pts += 50 * multiplier
			perfect_routes += 1
		
		score += pts
		routes_completed += 1
		
		if signal_core:
			signal_core.trigger_flash(PulseLoomConstants.LANE_COLORS[routed_lane])
		if radar_lanes:
			radar_lanes.trigger_lane_flash(routed_lane)
		if audio_synth:
			audio_synth.play_route_success(multiplier)
	else:
		streak = 0
		multiplier = 1
		overloads += 1
		
		if signal_core:
			signal_core.trigger_flash(Color(1.0, 0.2, 0.2), 0.35)
		if audio_synth:
			audio_synth.play_miss()
			audio_synth.play_overload_alert()
		
		if overloads >= PulseLoomConstants.MAX_OVERLOADS:
			_complete_run("overload")
			return
	
	_emit_score_update()

func _complete_run(outcome: String) -> void:
	set_state(State.ENDED)
	var completed := (outcome == "complete")
	if completed and audio_synth:
		audio_synth.play_victory()
	
	var medal := PulseLoomConstants.get_medal_for_score(score, completed)
	var duration := PulseLoomConstants.TOTAL_RUN_SECONDS - time_remaining
	
	var result := {
		"ticketId": ticket_id,
		"outcome": outcome,
		"score": score,
		"durationSeconds": roundi(duration),
		"routesCompleted": routes_completed,
		"perfectRoutes": perfect_routes,
		"maxMultiplier": max_multiplier,
		"overloads": overloads,
		"medal": medal
	}
	
	run_ended.emit(result)
	if web_bridge:
		web_bridge.send_run_ended(result)
	_emit_score_update()

func _clear_all_pulses() -> void:
	for p in active_pulses:
		if is_instance_valid(p):
			p.queue_free()
	active_pulses.clear()

func _emit_score_update() -> void:
	score_updated.emit(score, multiplier, overloads, time_remaining, current_stage)

func _emit_telemetry() -> void:
	if not web_bridge:
		return
	web_bridge.send_telemetry({
		"score": score,
		"multiplier": multiplier,
		"maxMultiplier": max_multiplier,
		"overloads": overloads,
		"maxOverloads": PulseLoomConstants.MAX_OVERLOADS,
		"timeRemaining": time_remaining,
		"stage": current_stage,
		"routesCompleted": routes_completed,
		"perfectRoutes": perfect_routes,
		"fps": Engine.get_frames_per_second()
	})
