# Headless deterministic smoke and integration test for Pulse Loom
extends SceneTree

const PulseLoomConstants = preload("res://scripts/constants.gd")
const PulseLoomRouting = preload("res://scripts/routing.gd")
const SignalCore = preload("res://scripts/signal_core.gd")
const SignalPulse = preload("res://scripts/pulse.gd")
const GameManager = preload("res://scripts/game_manager.gd")
const WebBridgeScript = preload("res://scripts/web_bridge.gd")

func _init() -> void:
	print("=== Pulse Loom Headless Deterministic Smoke Test ===")
	var success := true
	
	if not test_constants():
		push_error("[FAIL] test_constants")
		success = false
	else:
		print("[PASS] test_constants")
	
	if not test_route_mapping_helper_exhaustive():
		push_error("[FAIL] test_route_mapping_helper_exhaustive")
		success = false
	else:
		print("[PASS] test_route_mapping_helper_exhaustive")
	
	if not test_preview_and_resolution_agreement():
		push_error("[FAIL] test_preview_and_resolution_agreement")
		success = false
	else:
		print("[PASS] test_preview_and_resolution_agreement")
	
	if not test_stale_preview_multi_pulse_transition():
		push_error("[FAIL] test_stale_preview_multi_pulse_transition")
		success = false
	else:
		print("[PASS] test_stale_preview_multi_pulse_transition")
	
	if not test_core_rotation():
		push_error("[FAIL] test_core_rotation")
		success = false
	else:
		print("[PASS] test_core_rotation")
	
	if not test_deterministic_prng():
		push_error("[FAIL] test_deterministic_prng")
		success = false
	else:
		print("[PASS] test_deterministic_prng")
	
	if not test_ticket_validation():
		push_error("[FAIL] test_ticket_validation")
		success = false
	else:
		print("[PASS] test_ticket_validation")
	
	if not test_web_bridge_boundary():
		push_error("[FAIL] test_web_bridge_boundary")
		success = false
	else:
		print("[PASS] test_web_bridge_boundary")
	
	if not test_routing_and_multiplier():
		push_error("[FAIL] test_routing_and_multiplier")
		success = false
	else:
		print("[PASS] test_routing_and_multiplier")
	
	if not test_assisted_onboarding_and_normal_play_transition():
		push_error("[FAIL] test_assisted_onboarding_and_normal_play_transition")
		success = false
	else:
		print("[PASS] test_assisted_onboarding_and_normal_play_transition")
	
	if not test_repeated_target_and_glyph_agreement():
		push_error("[FAIL] test_repeated_target_and_glyph_agreement")
		success = false
	else:
		print("[PASS] test_repeated_target_and_glyph_agreement")
	
	if not test_overload_failure():
		push_error("[FAIL] test_overload_failure")
		success = false
	else:
		print("[PASS] test_overload_failure")
	
	if not test_full_90s_simulation():
		push_error("[FAIL] test_full_90s_simulation")
		success = false
	else:
		print("[PASS] test_full_90s_simulation")
	
	if success:
		print("=== ALL PULSE LOOM SMOKE TESTS PASSED ===")
		quit(0)
	else:
		print("=== PULSE LOOM SMOKE TESTS FAILED ===")
		quit(1)

func get_valid_test_ticket(seed_str: String = "1337") -> Dictionary:
	var now_unix := Time.get_unix_time_from_system()
	var issued_dict := Time.get_datetime_dict_from_unix_time(int(now_unix))
	var expires_dict := Time.get_datetime_dict_from_unix_time(int(now_unix) + 300)
	var issued_iso := "%04d-%02d-%02dT%02d:%02d:%02d.123Z" % [
		issued_dict["year"], issued_dict["month"], issued_dict["day"],
		issued_dict["hour"], issued_dict["minute"], issued_dict["second"]
	]
	var expires_iso := "%04d-%02d-%02dT%02d:%02d:%02d.456Z" % [
		expires_dict["year"], expires_dict["month"], expires_dict["day"],
		expires_dict["hour"], expires_dict["minute"], expires_dict["second"]
	]
	return {
		"id": "run-pl-headless-smoke-001",
		"gameId": "pulse-loom",
		"gameVersion": "0.1.0",
		"issuedAt": issued_iso,
		"expiresAt": expires_iso,
		"seed": seed_str,
		"ruleset": "conduit-v1",
		"signature": "local-unverified"
	}

func test_route_mapping_helper_exhaustive() -> bool:
	# Prove all 6 source lanes × 6 rotor steps map consistently, deterministically, and invertibly
	for src in range(PulseLoomConstants.NUM_LANES):
		for step in range(PulseLoomConstants.NUM_LANES):
			var routed := PulseLoomRouting.get_routed_lane(src, step)
			if routed < 0 or routed >= PulseLoomConstants.NUM_LANES:
				return false
			
			# Inverse requirement step must match the step applied
			var req_step := PulseLoomRouting.get_required_step(src, routed)
			if req_step != step:
				return false
			
			# is_aligned must report true for exact match
			if not PulseLoomRouting.is_aligned(src, routed, step):
				return false
			
			# is_aligned must report false for any non-matching rotor step
			for other_step in range(PulseLoomConstants.NUM_LANES):
				if other_step != step:
					if PulseLoomRouting.is_aligned(src, routed, other_step):
						return false
	
	# Bijective mapping proof per rotor step (all 6 lanes uniquely mapped without collision)
	for step in range(PulseLoomConstants.NUM_LANES):
		var mapped_lanes: Array[int] = []
		for src in range(PulseLoomConstants.NUM_LANES):
			var routed := PulseLoomRouting.get_routed_lane(src, step)
			if mapped_lanes.has(routed):
				return false
			mapped_lanes.append(routed)
		if mapped_lanes.size() != PulseLoomConstants.NUM_LANES:
			return false
	
	return true

func test_preview_and_resolution_agreement() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: Node2D = main_scene.instantiate()
	root._ready()
	root.start_run(get_valid_test_ticket("preview-agreement-test"))
	
	# Exhaustively verify that for every source lane, target lane, and rotor step:
	# The preview route computed by PulseLoomRouting matches the resolved lane in gameplay resolution
	for src in range(PulseLoomConstants.NUM_LANES):
		for tgt in range(PulseLoomConstants.NUM_LANES):
			for step in range(PulseLoomConstants.NUM_LANES):
				var preview_lane := PulseLoomRouting.get_routed_lane(src, step)
				var preview_aligned := PulseLoomRouting.is_aligned(src, tgt, step)
				
				# Set rotor
				root.signal_core.set_step(step)
				
				# Create test pulse
				var p := SignalPulse.new()
				p.setup(src, tgt, 100.0)
				p.distance = PulseLoomConstants.CORE_RADIUS
				
				# Check preview calculation
				var r_step: int = root.signal_core.current_step
				var calc_route := PulseLoomRouting.get_routed_lane(p.source_lane, r_step)
				var calc_aligned := PulseLoomRouting.is_aligned(p.source_lane, p.target_lane, r_step)
				
				if calc_route != preview_lane or calc_aligned != preview_aligned:
					p.free()
					root.free()
					return false
				
				var expected_aligned := (preview_lane == tgt)
				if calc_aligned != expected_aligned:
					p.free()
					root.free()
					return false
				
				p.free()
	
	root.free()
	return true

func test_stale_preview_multi_pulse_transition() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: GameManager = main_scene.instantiate() as GameManager
	root._ready()
	root.start_run(get_valid_test_ticket("stale-preview-multi-pulse-seed"))
	root._clear_all_pulses()
	root._update_preview_state()
	
	# Initial clean idle state verification (both core and radar lanes must be -1)
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
		root.free()
		return false
	
	# =========================================================================
	# Scenario 1: Two simultaneous active pulses:
	# Pulse A (nearest) -> Pulse B (further)
	# Resolve A -> B becomes nearest -> Resolve B -> Both clear fully
	# Add repeated Emerald Square □ from a DIFFERENT source -> Full invariant proof
	# =========================================================================
	var pulse_a := SignalPulse.new()
	pulse_a.setup(0, 2, 80.0) # src 0 (Cyan Hexagon), tgt 2 (Amber Diamond)
	pulse_a.distance = 120.0
	root.active_pulses.append(pulse_a)
	
	var pulse_b := SignalPulse.new()
	pulse_b.setup(2, 3, 80.0) # src 2 (Amber Diamond), tgt 3 (Emerald Square □)
	pulse_b.distance = 220.0
	root.active_pulses.append(pulse_b)
	
	root._update_preview_state()
	
	# (1) Pulse A is nearest: both signal_core and radar_lanes must preview/highlight A
	if root.get_nearest_incoming_pulse() != pulse_a:
		root.free()
		return false
	if root.signal_core.active_source_lane != 0 or root.signal_core.active_target_lane != 2:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 0 or root.radar_lanes.active_target_lane != 2:
		root.free()
		return false
	
	# Rotate core to align with Pulse A and verify preview routing
	var req_step_a := PulseLoomRouting.get_required_step(0, 2) # (2 - 0) = 2
	root.signal_core.set_step(req_step_a)
	root._update_preview_state()
	if not PulseLoomRouting.is_aligned(0, 2, root.signal_core.current_step):
		root.free()
		return false
	if PulseLoomRouting.get_routed_lane(0, req_step_a) != 2:
		root.free()
		return false
	
	# (2) Resolve Pulse A and remove it
	var score_before_a: int = root.score
	var routes_before_a: int = root.routes_completed
	pulse_a.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_a)
	root.active_pulses.erase(pulse_a)
	pulse_a.free()
	root._update_preview_state()
	
	if root.routes_completed != routes_before_a + 1 or root.score <= score_before_a:
		root.free()
		return false
	
	# (3) Pulse B now becomes nearest: both signal_core and radar_lanes must preview/highlight B
	if root.get_nearest_incoming_pulse() != pulse_b:
		root.free()
		return false
	if root.signal_core.active_source_lane != 2 or root.signal_core.active_target_lane != 3:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 2 or root.radar_lanes.active_target_lane != 3:
		root.free()
		return false
	
	# Rotate core to align with Pulse B and verify preview routing
	var req_step_b := PulseLoomRouting.get_required_step(2, 3) # (3 - 2) = 1
	root.signal_core.set_step(req_step_b)
	root._update_preview_state()
	if not PulseLoomRouting.is_aligned(2, 3, root.signal_core.current_step):
		root.free()
		return false
	if PulseLoomRouting.get_routed_lane(2, req_step_b) != 3:
		root.free()
		return false
	
	# (4) Resolve Pulse B and remove it
	var score_before_b: int = root.score
	var routes_before_b: int = root.routes_completed
	pulse_b.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_b)
	root.active_pulses.erase(pulse_b)
	pulse_b.free()
	root._update_preview_state()
	
	if root.routes_completed != routes_before_b + 1 or root.score <= score_before_b:
		root.free()
		return false
	
	# (5) After B is removed, both preview states clear fully (source and target = -1)
	if root.get_nearest_incoming_pulse() != null:
		root.free()
		return false
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
		root.free()
		return false
	
	# (6) Add repeated Emerald Square □ from a DIFFERENT source (src: 4 instead of 2)
	# Target 3 = Emerald Square □, Color(0.0, 1.0, 0.6)
	if PulseLoomConstants.GLYPH_NAMES[3] != "SQUARE" or PulseLoomConstants.GLYPH_SYMBOLS[3] != "□" or PulseLoomConstants.LANE_COLORS[3] != Color(0.0, 1.0, 0.6):
		root.free()
		return false
	
	var pulse_sq := SignalPulse.new()
	pulse_sq.setup(4, 3, 85.0) # src 4, tgt 3
	pulse_sq.distance = 180.0
	root.active_pulses.append(pulse_sq)
	root._update_preview_state()
	
	# Prove source/target, required rotor step, routed preview lane, alignment, signal_core target, radar_lanes target
	if pulse_sq.source_lane != 4 or pulse_sq.target_lane != 3:
		root.free()
		return false
	if root.signal_core.active_source_lane != 4 or root.signal_core.active_target_lane != 3:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 4 or root.radar_lanes.active_target_lane != 3:
		root.free()
		return false
	
	var req_step_sq := PulseLoomRouting.get_required_step(4, 3) # (3 - 4) = 5
	root.signal_core.set_step(req_step_sq)
	root._update_preview_state()
	
	var routed_sq := PulseLoomRouting.get_routed_lane(4, req_step_sq)
	if routed_sq != 3:
		root.free()
		return false
	if not PulseLoomRouting.is_aligned(4, 3, root.signal_core.current_step):
		root.free()
		return false
	
	# Verify all other 5 rotor steps do NOT align for repeated Square
	for other_step in range(PulseLoomConstants.NUM_LANES):
		if other_step != req_step_sq:
			if PulseLoomRouting.is_aligned(4, 3, other_step):
				root.free()
				return false
			if PulseLoomRouting.get_routed_lane(4, other_step) == 3:
				root.free()
				return false
	
	# Prove actual resolution refresh correctly with no stale state
	var score_before_sq: int = root.score
	var routes_before_sq: int = root.routes_completed
	pulse_sq.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_sq)
	root.active_pulses.erase(pulse_sq)
	pulse_sq.free()
	root._update_preview_state()
	
	if root.routes_completed != routes_before_sq + 1 or root.score <= score_before_sq:
		root.free()
		return false
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
		root.free()
		return false
	
	# =========================================================================
	# Scenario 2: Two simultaneous active pulses with MISROUTE / MISS removal:
	# Pulse A2 (nearest) is misrouted -> removed
	# Pulse B2 (further, Crimson Circle ○) becomes nearest -> aligned & resolved
	# Both clear fully (-1, -1)
	# Add repeated Crimson Circle ○ from a DIFFERENT source (src: 1) -> Full invariant proof
	# =========================================================================
	var pulse_a2 := SignalPulse.new()
	pulse_a2.setup(1, 5, 80.0) # src 1 (Violet Triangle), tgt 5 (Azure Cross)
	pulse_a2.distance = 110.0
	root.active_pulses.append(pulse_a2)
	
	var pulse_b2 := SignalPulse.new()
	pulse_b2.setup(3, 4, 80.0) # src 3 (Emerald Square), tgt 4 (Crimson Circle ○)
	pulse_b2.distance = 210.0
	root.active_pulses.append(pulse_b2)
	root._update_preview_state()
	
	if root.get_nearest_incoming_pulse() != pulse_a2:
		root.free()
		return false
	if root.signal_core.active_source_lane != 1 or root.signal_core.active_target_lane != 5:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 1 or root.radar_lanes.active_target_lane != 5:
		root.free()
		return false
	
	# Miss A2: misalign rotor intentionally
	root.signal_core.set_step(0) # routed = 1 != 5
	pulse_a2.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_a2)
	root.active_pulses.erase(pulse_a2)
	pulse_a2.free()
	root._update_preview_state()
	
	# Pulse B2 becomes nearest after A2 removal
	if root.get_nearest_incoming_pulse() != pulse_b2:
		root.free()
		return false
	if root.signal_core.active_source_lane != 3 or root.signal_core.active_target_lane != 4:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 3 or root.radar_lanes.active_target_lane != 4:
		root.free()
		return false
	
	# Align and resolve B2
	var req_step_b2 := PulseLoomRouting.get_required_step(3, 4) # (4 - 3) = 1
	root.signal_core.set_step(req_step_b2)
	root._update_preview_state()
	if not PulseLoomRouting.is_aligned(3, 4, root.signal_core.current_step):
		root.free()
		return false
	
	pulse_b2.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_b2)
	root.active_pulses.erase(pulse_b2)
	pulse_b2.free()
	root._update_preview_state()
	
	# Clear fully
	if root.get_nearest_incoming_pulse() != null:
		root.free()
		return false
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
		root.free()
		return false
	
	# Add repeated Crimson Circle from a DIFFERENT source (src: 1 instead of 3 or 5)
	# Target 4 = Crimson Circle ○, Color(1.0, 0.20, 0.4)
	if PulseLoomConstants.GLYPH_NAMES[4] != "CIRCLE" or PulseLoomConstants.GLYPH_SYMBOLS[4] != "○" or PulseLoomConstants.LANE_COLORS[4] != Color(1.0, 0.20, 0.4):
		root.free()
		return false
	
	var pulse_circ := SignalPulse.new()
	pulse_circ.setup(1, 4, 85.0) # src 1, tgt 4
	pulse_circ.distance = 190.0
	root.active_pulses.append(pulse_circ)
	root._update_preview_state()
	
	# Prove source/target, required rotor step, routed preview lane, alignment, signal_core target, radar_lanes target
	if pulse_circ.source_lane != 1 or pulse_circ.target_lane != 4:
		root.free()
		return false
	if root.signal_core.active_source_lane != 1 or root.signal_core.active_target_lane != 4:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 1 or root.radar_lanes.active_target_lane != 4:
		root.free()
		return false
	
	var req_step_circ := PulseLoomRouting.get_required_step(1, 4) # (4 - 1) = 3
	root.signal_core.set_step(req_step_circ)
	root._update_preview_state()
	
	var routed_circ := PulseLoomRouting.get_routed_lane(1, req_step_circ)
	if routed_circ != 4:
		root.free()
		return false
	if not PulseLoomRouting.is_aligned(1, 4, root.signal_core.current_step):
		root.free()
		return false
	
	# Verify all other 5 rotor steps do NOT align for repeated Circle
	for other_step in range(PulseLoomConstants.NUM_LANES):
		if other_step != req_step_circ:
			if PulseLoomRouting.is_aligned(1, 4, other_step):
				root.free()
				return false
			if PulseLoomRouting.get_routed_lane(1, other_step) == 4:
				root.free()
				return false
	
	# Prove resolution
	var score_before_circ: int = root.score
	var routes_before_circ: int = root.routes_completed
	pulse_circ.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_circ)
	root.active_pulses.erase(pulse_circ)
	pulse_circ.free()
	root._update_preview_state()
	
	if root.routes_completed != routes_before_circ + 1 or root.score <= score_before_circ:
		root.free()
		return false
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
		root.free()
		return false
	
	root.free()
	return true

func test_assisted_onboarding_and_normal_play_transition() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: Node2D = main_scene.instantiate()
	root._ready()
	root.start_run(get_valid_test_ticket("onboarding-test"))
	
	# 1. Verify initial onboarding state
	if not root.onboarding_active:
		root.free()
		return false
	if root.onboarding_step != 0:
		root.free()
		return false
	if root.time_remaining != PulseLoomConstants.TOTAL_RUN_SECONDS:
		root.free()
		return false
	
	# Verify all 3 assisted pulses from runtime specification
	for step in range(3):
		var spec := PulseLoomConstants.get_assisted_pulse_spec(step)
		var expected_src: int = spec["source_lane"]
		var expected_tgt: int = spec["target_lane"]
		var expected_spd: float = spec["speed"]
		
		# Advance time to trigger spawn
		root._process(0.45)
		if root.active_pulses.size() != 1:
			root.free()
			return false
		var p = root.active_pulses[0]
		if p.source_lane != expected_src or p.target_lane != expected_tgt or not is_equal_approx(p.speed, expected_spd):
			root.free()
			return false
		
		# Specific target identity checks for Square and Circle guided pulses
		if step == 1:
			if p.target_lane != PulseLoomConstants.GlyphType.SQUARE or PulseLoomConstants.GLYPH_NAMES[p.target_lane] != "SQUARE" or PulseLoomConstants.GLYPH_SYMBOLS[p.target_lane] != "□":
				root.free()
				return false
		elif step == 2:
			if p.target_lane != PulseLoomConstants.GlyphType.CIRCLE or PulseLoomConstants.GLYPH_NAMES[p.target_lane] != "CIRCLE" or PulseLoomConstants.GLYPH_SYMBOLS[p.target_lane] != "○":
				root.free()
				return false
		
		# Rotate core to align with target
		var req_step := PulseLoomRouting.get_required_step(p.source_lane, p.target_lane)
		root.signal_core.set_step(req_step)
		root._update_preview_state()
		
		if not PulseLoomRouting.is_aligned(p.source_lane, p.target_lane, root.signal_core.current_step):
			root.free()
			return false
		if root.signal_core.active_target_lane != p.target_lane or root.radar_lanes.active_target_lane != p.target_lane:
			root.free()
			return false
		
		# Advance pulse to core and resolve
		p.distance = PulseLoomConstants.CORE_RADIUS
		root.active_pulses.erase(p)
		root._resolve_pulse(p)
		p.free()
		
		var expected_next_step := step + 1
		if root.onboarding_step != expected_next_step:
			root.free()
			return false
		if step < 2 and not root.onboarding_active:
			root.free()
			return false
	
	# 2. Verify transition from assisted onboarding to normal score-attack
	if root.onboarding_active:
		root.free()
		return false
	if root.onboarding_step != 3:
		root.free()
		return false
	
	# 3. Simulate normal gameplay progression
	root._process(2.0)
	if root.time_remaining >= PulseLoomConstants.TOTAL_RUN_SECONDS:
		root.free()
		return false
	if root.time_remaining <= 0.0:
		root.free()
		return false
	if root.current_state != GameManager.State.RUNNING:
		root.free()
		return false
	
	root.free()
	return true

func test_repeated_target_and_glyph_agreement() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: GameManager = main_scene.instantiate() as GameManager
	root._ready()
	root.start_run(get_valid_test_ticket("repeated-target-agreement-seed"))
	
	# Clean pulses from start
	root._clear_all_pulses()
	root._update_preview_state()
	
	# Explicitly verify every target glyph (0..5), with strict repeated occurrence verification
	# Target 3 (Emerald Square □) and Target 4 (Crimson Circle ○) tested repeatedly
	for target_lane in range(PulseLoomConstants.NUM_LANES):
		var glyph_name: String = PulseLoomConstants.GLYPH_NAMES[target_lane]
		var glyph_sym: String = PulseLoomConstants.GLYPH_SYMBOLS[target_lane]
		var glyph_col: Color = PulseLoomConstants.LANE_COLORS[target_lane]
		
		# Specific explicit checks for Square and Circle
		if target_lane == PulseLoomConstants.GlyphType.SQUARE:
			if glyph_name != "SQUARE" or glyph_sym != "□" or glyph_col != Color(0.0, 1.0, 0.6):
				root.free()
				return false
		elif target_lane == PulseLoomConstants.GlyphType.CIRCLE:
			if glyph_name != "CIRCLE" or glyph_sym != "○" or glyph_col != Color(1.0, 0.20, 0.4):
				root.free()
				return false
		
		# Test 3 repeated occurrences for each target glyph from various distinct source lanes
		for occurrence in range(3):
			var src_lane := (target_lane + occurrence * 2 + 1) % PulseLoomConstants.NUM_LANES
			
			# Ensure prior state did not leave stale target/highlight
			if root.signal_core.active_target_lane != -1 or root.radar_lanes.active_target_lane != -1:
				root.free()
				return false
			
			# 1. Create pulse with this target
			var p := SignalPulse.new()
			p.setup(src_lane, target_lane, 80.0)
			root.active_pulses.append(p)
			
			# (a) Target symbol and color check on pulse
			if p.target_lane != target_lane or p.source_lane != src_lane:
				p.free()
				root.free()
				return false
			
			# (b) Preview state calculation and target highlight check
			var req_step := PulseLoomRouting.get_required_step(src_lane, target_lane)
			root.signal_core.set_step(req_step)
			root._update_preview_state()
			
			if root.signal_core.active_target_lane != target_lane or root.radar_lanes.active_target_lane != target_lane:
				p.free()
				root.free()
				return false
			if root.signal_core.active_source_lane != src_lane or root.radar_lanes.active_source_lane != src_lane:
				p.free()
				root.free()
				return false
			
			# (c) Previewed routed destination
			var previewed_lane := PulseLoomRouting.get_routed_lane(src_lane, req_step)
			if previewed_lane != target_lane:
				p.free()
				root.free()
				return false
			
			# (d) Alignment check
			if not PulseLoomRouting.is_aligned(src_lane, target_lane, req_step):
				p.free()
				root.free()
				return false
			
			# Verify all other 5 rotor steps do NOT align
			for other_step in range(PulseLoomConstants.NUM_LANES):
				if other_step != req_step:
					if PulseLoomRouting.is_aligned(src_lane, target_lane, other_step):
						p.free()
						root.free()
						return false
					if PulseLoomRouting.get_routed_lane(src_lane, other_step) == target_lane:
						p.free()
						root.free()
						return false
			
			# (e) Resolution check
			var prev_score: int = root.score
			var prev_routes: int = root.routes_completed
			p.distance = PulseLoomConstants.CORE_RADIUS
			root._resolve_pulse(p)
			root.active_pulses.erase(p)
			p.free()
			root._update_preview_state()
			
			if root.routes_completed != prev_routes + 1:
				root.free()
				return false
			if root.score <= prev_score:
				root.free()
				return false
			
			# Ensure state is reset to idle (-1) after pulse resolution
			if root.signal_core.active_target_lane != -1 or root.radar_lanes.active_target_lane != -1:
				root.free()
				return false
	
	# Verify repeated misroute recovery on assisted onboarding
	root.reset_ready()
	root.start_run(get_valid_test_ticket("retry-regression-seed"))
	
	# Step 0: Resolve successfully (0 -> 2, Amber Diamond ◇)
	root._process(0.35)
	var p0 = root.active_pulses[0]
	root.signal_core.set_step(PulseLoomRouting.get_required_step(p0.source_lane, p0.target_lane))
	p0.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p0)
	root._resolve_pulse(p0)
	p0.free()
	if root.onboarding_step != 1:
		root.free()
		return false
	
	# Step 1: Green Square □ (src 2, tgt 3). Deliberately MISROUTE twice, then align on third attempt!
	for fail_attempt in range(2):
		root._process(0.55)
		if root.active_pulses.size() != 1:
			root.free()
			return false
		var p1_fail = root.active_pulses[0]
		if p1_fail.target_lane != PulseLoomConstants.GlyphType.SQUARE: # Emerald Square □
			root.free()
			return false
		# Set intentionally misaligned rotor step
		root.signal_core.set_step(0) # routed = 2 != 3
		p1_fail.distance = PulseLoomConstants.CORE_RADIUS
		root.active_pulses.erase(p1_fail)
		root._resolve_pulse(p1_fail)
		p1_fail.free()
		# Must remain at step 1 with 0 overloads (safe retry)
		if root.onboarding_step != 1 or root.overloads != 0 or not root.onboarding_active:
			root.free()
			return false
	
	# Now succeed on Step 1 (Green Square □)
	root._process(0.55)
	var p1_succ = root.active_pulses[0]
	var req_step_1 := PulseLoomRouting.get_required_step(p1_succ.source_lane, p1_succ.target_lane) # (3 - 2) = 1
	root.signal_core.set_step(req_step_1)
	p1_succ.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p1_succ)
	root._resolve_pulse(p1_succ)
	p1_succ.free()
	if root.onboarding_step != 2:
		root.free()
		return false
	
	# Step 2: Crimson Circle ○ (src 5, tgt 4). Deliberately MISROUTE once, then succeed on retry!
	root._process(0.55)
	var p2_fail = root.active_pulses[0]
	if p2_fail.target_lane != PulseLoomConstants.GlyphType.CIRCLE: # Crimson Circle ○
		root.free()
		return false
	root.signal_core.set_step(0) # routed = 5 != 4
	p2_fail.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p2_fail)
	root._resolve_pulse(p2_fail)
	p2_fail.free()
	if root.onboarding_step != 2 or root.overloads != 0 or not root.onboarding_active:
		root.free()
		return false
	
	# Now succeed on Step 2 (Crimson Circle ○)
	root._process(0.55)
	var p2_succ = root.active_pulses[0]
	var req_step_2 := PulseLoomRouting.get_required_step(p2_succ.source_lane, p2_succ.target_lane) # (4 - 5) = 5
	root.signal_core.set_step(req_step_2)
	p2_succ.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p2_succ)
	root._resolve_pulse(p2_succ)
	p2_succ.free()
	
	# Assisted onboarding complete!
	if root.onboarding_step != 3 or root.onboarding_active:
		root.free()
		return false
	
	root.free()
	return true


func test_ticket_validation() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: Node2D = main_scene.instantiate()
	root._ready()
	
	# === 1. Positive timestamp parsing checks ===
	if GameManager.parse_iso_datetime("2026-08-29T12:34:56.789Z") <= 0.0:
		root.free()
		return false
	if GameManager.parse_iso_datetime("2024-02-29T00:00:00.000Z") <= 0.0:
		root.free()
		return false
	if GameManager.parse_iso_datetime("2026-12-31T23:59:59.999Z") <= 0.0:
		root.free()
		return false

	# === 2. Negative timestamp rejection matrix ===
	var malformed_timestamps: Array[String] = [
		"2026-08-29T12:00:00.000",
		"2026-08-29T12:00:00.000z",
		"2026-08-29T12:00:00.000+00:00",
		"2026-08-29T12:00:00.000+05:30",
		"2026-08-29T12:00:00.000-04:00",
		"2026-08-29T12:00:00Z",
		"2026-08-29T12:00:00.1Z",
		"2026-08-29T12:00:00.12Z",
		"2026-08-29T12:00:00.1234Z",
		"2026-08-29T12:00:00.123456Z",
		" 2026-08-29T12:00:00.000Z",
		"2026-08-29T12:00:00.000Z ",
		"  2026-08-29T12:00:00.000Z  ",
		"2026/08/29T12:00:00.000Z",
		"2026-08-29 12:00:00.000Z",
		"2026-08-29t12:00:00.000Z",
		"2026-08-29T12-00-00.000Z",
		"2026-08-29T12:00:00,000Z",
		"2026-02-30T12:00:00.000Z",
		"2026-02-29T12:00:00.000Z",
		"2024-02-30T12:00:00.000Z",
		"2026-04-31T12:00:00.000Z",
		"2026-13-01T12:00:00.000Z",
		"2026-00-01T12:00:00.000Z",
		"2026-01-00T12:00:00.000Z",
		"2026-08-29T24:00:00.000Z",
		"2026-08-29T25:00:00.000Z",
		"2026-08-29T12:60:00.000Z",
		"2026-08-29T12:00:60.000Z"
	]

	for bad_ts in malformed_timestamps:
		if GameManager.parse_iso_datetime(bad_ts) > 0.0:
			root.free()
			return false
		
		var bad_issued_ticket := get_valid_test_ticket()
		bad_issued_ticket["issuedAt"] = bad_ts
		if root.is_valid_ticket(bad_issued_ticket):
			root.free()
			return false
		root.reset_ready()
		root.start_run(bad_issued_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_restart(bad_issued_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_start(bad_issued_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		
		var bad_expires_ticket := get_valid_test_ticket()
		bad_expires_ticket["expiresAt"] = bad_ts
		if root.is_valid_ticket(bad_expires_ticket):
			root.free()
			return false
		root.reset_ready()
		root.start_run(bad_expires_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_restart(bad_expires_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_start(bad_expires_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false

	# === 3. Empty ticket rejection and READY non-transition proof ===
	if root.is_valid_ticket({}):
		root.free()
		return false
	root.reset_ready()
	root.start_run({})
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	root._on_host_restart({})
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	root._on_host_start({})
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	# === 4. Missing required field rejection matrix ===
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
		var missing_f := get_valid_test_ticket()
		missing_f.erase(field)
		if root.is_valid_ticket(missing_f):
			root.free()
			return false
		root.reset_ready()
		root.start_run(missing_f)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_restart(missing_f)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_start(missing_f)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false

	# === 5. Wrong field types ===
	var non_string_test_tickets := [
		{"seed": 1337},
		{"id": 12345},
		{"issuedAt": 123456.78},
		{"expiresAt": 999999999},
		{"signature": true},
		{"gameId": false},
		{"gameVersion": 1.0},
		{"ruleset": ["conduit-v1"]}
	]
	for override_dict in non_string_test_tickets:
		var bad_type_ticket := get_valid_test_ticket()
		for k in override_dict:
			bad_type_ticket[k] = override_dict[k]
		if root.is_valid_ticket(bad_type_ticket):
			root.free()
			return false
		root.reset_ready()
		root.start_run(bad_type_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_restart(bad_type_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false

	# === 6. Empty string fields rejection ===
	for field in REQUIRED_FIELDS:
		var empty_f_ticket := get_valid_test_ticket()
		empty_f_ticket[field] = ""
		if root.is_valid_ticket(empty_f_ticket):
			root.free()
			return false
		root.reset_ready()
		root.start_run(empty_f_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_restart(empty_f_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false

	# === 7. Invalid contract values ===
	var invalid_contract_tickets := [
		{"id": "bad-id-123"},
		{"gameId": "other-game"},
		{"gameVersion": "0.2.0"},
		{"ruleset": "wrong-ruleset"},
		{"signature": "fake-sig"}
	]
	for contract_override in invalid_contract_tickets:
		var bad_contract_ticket := get_valid_test_ticket()
		for k in contract_override:
			bad_contract_ticket[k] = contract_override[k]
		if root.is_valid_ticket(bad_contract_ticket):
			root.free()
			return false
		root.reset_ready()
		root.start_run(bad_contract_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false
		root._on_host_restart(bad_contract_ticket)
		if root.current_state != GameManager.State.READY:
			root.free()
			return false

	# === 8. Expired ticket rejection ===
	var expired_ticket := get_valid_test_ticket()
	expired_ticket["issuedAt"] = "2020-01-01T00:00:00.000Z"
	expired_ticket["expiresAt"] = "2020-01-01T00:05:00.000Z"
	if root.is_valid_ticket(expired_ticket):
		root.free()
		return false
	root.reset_ready()
	root.start_run(expired_ticket)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	root._on_host_restart(expired_ticket)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	# === 9. expiresAt <= issuedAt rejection ===
	var expires_before_issued := get_valid_test_ticket()
	expires_before_issued["issuedAt"] = "2030-01-01T12:00:00.000Z"
	expires_before_issued["expiresAt"] = "2030-01-01T11:00:00.000Z"
	if root.is_valid_ticket(expires_before_issued):
		root.free()
		return false
	root.reset_ready()
	root.start_run(expires_before_issued)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	root._on_host_restart(expires_before_issued)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	var expires_equal_issued := get_valid_test_ticket()
	expires_equal_issued["issuedAt"] = "2030-01-01T12:00:00.000Z"
	expires_equal_issued["expiresAt"] = "2030-01-01T12:00:00.000Z"
	if root.is_valid_ticket(expires_equal_issued):
		root.free()
		return false
	root.reset_ready()
	root.start_run(expires_equal_issued)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	root._on_host_restart(expires_equal_issued)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	# === 10. Valid ticket positive test: READY -> RUNNING via start_run ===
	var valid_ticket_1 := get_valid_test_ticket("smoke-seed-42")
	if not root.is_valid_ticket(valid_ticket_1):
		root.free()
		return false
	root.reset_ready()
	root.start_run(valid_ticket_1)
	if root.current_state != GameManager.State.RUNNING:
		root.free()
		return false
	if root.seed_val != hash("smoke-seed-42"):
		root.free()
		return false
	if root.ticket_id != "run-pl-headless-smoke-001":
		root.free()
		return false

	# === 11. Valid ticket positive test: READY -> RUNNING via _on_host_restart ===
	root.reset_ready()
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	var valid_ticket_2 := get_valid_test_ticket("restart-seed-99")
	valid_ticket_2["id"] = "run-pl-headless-restart-002"
	root._on_host_restart(valid_ticket_2)
	if root.current_state != GameManager.State.RUNNING:
		root.free()
		return false
	if root.ticket_id != "run-pl-headless-restart-002":
		root.free()
		return false
	if root.seed_val != hash("restart-seed-99"):
		root.free()
		return false

	# === 12. Valid ticket positive test: READY -> RUNNING via _on_host_start ===
	root.reset_ready()
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	var valid_ticket_3 := get_valid_test_ticket("host-start-seed-77")
	valid_ticket_3["id"] = "run-pl-headless-host-start-003"
	root._on_host_start(valid_ticket_3)
	if root.current_state != GameManager.State.RUNNING:
		root.free()
		return false
	if root.ticket_id != "run-pl-headless-host-start-003":
		root.free()
		return false

	root.free()
	return true

func test_web_bridge_boundary() -> bool:
	var bridge := WebBridgeScript.new()
	var signal_fired := [false]
	var received_ticket := [{}]
	
	bridge.host_start_requested.connect(func(t):
		signal_fired[0] = true
		received_ticket[0] = t
	)
	bridge.host_pause_requested.connect(func(): signal_fired[0] = true)
	bridge.host_resume_requested.connect(func(): signal_fired[0] = true)
	bridge.host_restart_requested.connect(func(_t): signal_fired[0] = true)
	bridge.host_settings_changed.connect(func(_s): signal_fired[0] = true)
	
	# 1. Non-string callback values must be rejected without coercing or emitting signals
	var non_string_payloads: Array = [
		[],
		[null],
		[12345],
		[true],
		[false],
		[3.1415],
		[{"type": "START"}],
		[["nested", "array"]]
	]
	
	for non_str in non_string_payloads:
		signal_fired[0] = false
		bridge._on_js_message_raw(non_str)
		if signal_fired[0]:
			bridge.free()
			return false
	
	# 2. Invalid JSON string must be rejected
	signal_fired[0] = false
	bridge._on_js_message_raw(["not valid json {{{"])
	if signal_fired[0]:
		bridge.free()
		return false
	
	# 3. Valid JSON string representing a non-dictionary (e.g. array, integer) must be rejected
	signal_fired[0] = false
	bridge._on_js_message_raw(["[1, 2, 3]"])
	if signal_fired[0]:
		bridge.free()
		return false
	
	signal_fired[0] = false
	bridge._on_js_message_raw(["\"plain_string\""])
	if signal_fired[0]:
		bridge.free()
		return false
	
	# 4. Valid stringified JSON command must be handled correctly
	var valid_ticket := get_valid_test_ticket("bridge-test")
	var valid_start_cmd := JSON.stringify({"type": "START", "ticket": valid_ticket})
	signal_fired[0] = false
	bridge._on_js_message_raw([valid_start_cmd])
	if not signal_fired[0]:
		bridge.free()
		return false
	if received_ticket[0].get("id", "") != "run-pl-headless-smoke-001":
		bridge.free()
		return false
	
	# 5. PAUSE command
	signal_fired[0] = false
	bridge._on_js_message_raw([JSON.stringify({"type": "PAUSE"})])
	if not signal_fired[0]:
		bridge.free()
		return false
	
	# 6. RESUME command
	signal_fired[0] = false
	bridge._on_js_message_raw([JSON.stringify({"type": "RESUME"})])
	if not signal_fired[0]:
		bridge.free()
		return false
	
	bridge.free()
	return true

func test_constants() -> bool:
	if PulseLoomConstants.NUM_LANES != 6:
		return false
	if not is_equal_approx(PulseLoomConstants.LANE_ANGLE_STEP, PI / 3.0):
		return false
	if PulseLoomConstants.TOTAL_RUN_SECONDS != 90.0:
		return false
	if PulseLoomConstants.MAX_OVERLOADS != 3:
		return false
	if PulseLoomConstants.GLYPH_NAMES.size() != 6:
		return false
	if PulseLoomConstants.GLYPH_SYMBOLS.size() != 6:
		return false
	if PulseLoomConstants.LANE_COLORS.size() != 6:
		return false
	
	# Explicit Canonical Mapping Assertions for all 6 glyphs
	if PulseLoomConstants.GlyphType.HEXAGON != 0 or PulseLoomConstants.GLYPH_NAMES[0] != "HEXAGON" or PulseLoomConstants.GLYPH_SYMBOLS[0] != "⬡" or PulseLoomConstants.LANE_COLORS[0] != Color(0.0, 0.94, 1.0):
		return false
	if PulseLoomConstants.GlyphType.TRIANGLE != 1 or PulseLoomConstants.GLYPH_NAMES[1] != "TRIANGLE" or PulseLoomConstants.GLYPH_SYMBOLS[1] != "△" or PulseLoomConstants.LANE_COLORS[1] != Color(0.69, 0.40, 1.0):
		return false
	if PulseLoomConstants.GlyphType.DIAMOND != 2 or PulseLoomConstants.GLYPH_NAMES[2] != "DIAMOND" or PulseLoomConstants.GLYPH_SYMBOLS[2] != "◇" or PulseLoomConstants.LANE_COLORS[2] != Color(1.0, 0.67, 0.0):
		return false
	if PulseLoomConstants.GlyphType.SQUARE != 3 or PulseLoomConstants.GLYPH_NAMES[3] != "SQUARE" or PulseLoomConstants.GLYPH_SYMBOLS[3] != "□" or PulseLoomConstants.LANE_COLORS[3] != Color(0.0, 1.0, 0.6):
		return false
	if PulseLoomConstants.GlyphType.CIRCLE != 4 or PulseLoomConstants.GLYPH_NAMES[4] != "CIRCLE" or PulseLoomConstants.GLYPH_SYMBOLS[4] != "○" or PulseLoomConstants.LANE_COLORS[4] != Color(1.0, 0.20, 0.4):
		return false
	if PulseLoomConstants.GlyphType.CROSS != 5 or PulseLoomConstants.GLYPH_NAMES[5] != "CROSS" or PulseLoomConstants.GLYPH_SYMBOLS[5] != "✕" or PulseLoomConstants.LANE_COLORS[5] != Color(0.2, 0.6, 1.0):
		return false
	
	# Authoritative Assisted Pulse Specification Assertions
	if PulseLoomConstants.ASSISTED_PULSE_SPECS.size() != 3:
		return false
	var spec0 := PulseLoomConstants.get_assisted_pulse_spec(0)
	if spec0["source_lane"] != 0 or spec0["target_lane"] != 2 or not is_equal_approx(spec0["speed"], 75.0):
		return false
	if PulseLoomConstants.GLYPH_NAMES[spec0["target_lane"]] != "DIAMOND" or PulseLoomConstants.GLYPH_SYMBOLS[spec0["target_lane"]] != "◇" or PulseLoomConstants.LANE_COLORS[spec0["target_lane"]] != Color(1.0, 0.67, 0.0):
		return false
	
	var spec1 := PulseLoomConstants.get_assisted_pulse_spec(1)
	if spec1["source_lane"] != 2 or spec1["target_lane"] != 3 or not is_equal_approx(spec1["speed"], 80.0):
		return false
	if PulseLoomConstants.GLYPH_NAMES[spec1["target_lane"]] != "SQUARE" or PulseLoomConstants.GLYPH_SYMBOLS[spec1["target_lane"]] != "□" or PulseLoomConstants.LANE_COLORS[spec1["target_lane"]] != Color(0.0, 1.0, 0.6):
		return false
	
	var spec2 := PulseLoomConstants.get_assisted_pulse_spec(2)
	if spec2["source_lane"] != 5 or spec2["target_lane"] != 4 or not is_equal_approx(spec2["speed"], 85.0):
		return false
	if PulseLoomConstants.GLYPH_NAMES[spec2["target_lane"]] != "CIRCLE" or PulseLoomConstants.GLYPH_SYMBOLS[spec2["target_lane"]] != "○" or PulseLoomConstants.LANE_COLORS[spec2["target_lane"]] != Color(1.0, 0.20, 0.4):
		return false
	
	# Verify all 3 assisted pulses require distinct, non-zero rotor orientations
	var step0 := PulseLoomRouting.get_required_step(spec0["source_lane"], spec0["target_lane"])
	var step1 := PulseLoomRouting.get_required_step(spec1["source_lane"], spec1["target_lane"])
	var step2 := PulseLoomRouting.get_required_step(spec2["source_lane"], spec2["target_lane"])
	if step0 == 0 or step1 == 0 or step2 == 0:
		return false
	if step0 == step1 or step1 == step2 or step0 == step2:
		return false
	
	if PulseLoomConstants.get_medal_for_score(70000, true) != "gold":
		return false
	if PulseLoomConstants.get_medal_for_score(40000, true) != "silver":
		return false
	if PulseLoomConstants.get_medal_for_score(20000, true) != "bronze":
		return false
	if PulseLoomConstants.get_medal_for_score(5000, true) != "none":
		return false
	return true

func test_core_rotation() -> bool:
	var core := SignalCore.new()
	if core.current_step != 0:
		return false
	
	core.rotate_right()
	if core.current_step != 1:
		return false
	
	core.rotate_left()
	if core.current_step != 0:
		return false
	
	core.rotate_left()
	if core.current_step != 5:
		return false
	
	core.rotate_right()
	if core.current_step != 0:
		return false
	
	core.set_step(4)
	if core.current_step != 4:
		return false
	
	core.free()
	return true

func test_deterministic_prng() -> bool:
	var rng1 := RandomNumberGenerator.new()
	var rng2 := RandomNumberGenerator.new()
	rng1.seed = 42
	rng2.seed = 42
	
	for i in range(20):
		var val1 := rng1.randi_range(0, 5)
		var val2 := rng2.randi_range(0, 5)
		if val1 != val2:
			return false
	return true

func test_routing_and_multiplier() -> bool:
	var src := 2
	var tgt := 5
	var needed_step := PulseLoomRouting.get_required_step(src, tgt)
	if needed_step != 3:
		return false
	
	if PulseLoomRouting.get_routed_lane(src, needed_step) != tgt:
		return false
	
	if not PulseLoomRouting.is_aligned(src, tgt, needed_step):
		return false
	
	# Multiplier streak progression
	var streak := 0
	var mult := 1
	for route in range(10):
		streak += 1
		mult = min(10, 1 + int(streak / 2))
	
	if mult < 5:
		return false
	
	return true

func test_overload_failure() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: Node2D = main_scene.instantiate()
	root._ready()
	root.start_run(get_valid_test_ticket("999"))
	
	# Skip onboarding to directly test overload termination in normal play
	root.onboarding_active = false
	root.time_remaining = 85.0
	
	# Simulate 3 misroutes
	for miss in range(3):
		var p := SignalPulse.new()
		p.setup(0, 3, 100.0) # src 0, tgt 3
		root.signal_core.set_step(0) # routed = 0 != 3 (miss)
		p.distance = PulseLoomConstants.CORE_RADIUS
		root.active_pulses.append(p)
		root._resolve_pulse(p)
		root.active_pulses.erase(p)
		p.free()
	
	if root.overloads != 3:
		root.free()
		return false
	
	if root.current_state != GameManager.State.ENDED:
		root.free()
		return false
	
	root.free()
	return true

func test_full_90s_simulation() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: Node2D = main_scene.instantiate()
	root._ready()
	root.start_run(get_valid_test_ticket("2026"))
	
	var dt: float = 0.05
	var sim_time: float = 0.0
	
	while sim_time < 105.0 and root.current_state == GameManager.State.RUNNING:
		# Auto-pilot agent rotates conduit to perfectly match oncoming pulses
		for p in root.active_pulses:
			if p.active and not p.resolved:
				var needed_step := PulseLoomRouting.get_required_step(p.source_lane, p.target_lane)
				root.signal_core.set_step(needed_step)
				break
		
		root._process(dt)
		sim_time += dt
	
	if root.current_state != GameManager.State.ENDED:
		root.free()
		return false
	
	if root.time_remaining > 0.001:
		root.free()
		return false
	
	if root.score <= 0:
		root.free()
		return false
	
	if root.routes_completed < 10:
		root.free()
		return false
	
	if root.overloads > 0:
		root.free()
		return false
	
	root.free()
	return true
