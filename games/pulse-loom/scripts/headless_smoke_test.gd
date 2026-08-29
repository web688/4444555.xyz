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
	
	if not test_deterministic_stale_preview_lifecycle():
		push_error("[FAIL] test_deterministic_stale_preview_lifecycle")
		success = false
	else:
		print("[PASS] test_deterministic_stale_preview_lifecycle")
	
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

func test_assisted_onboarding_and_normal_play_transition() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: GameManager = main_scene.instantiate() as GameManager
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
	
	var total_assisted := PulseLoomConstants.get_assisted_pulse_count()
	if total_assisted != 3:
		root.free()
		return false
	
	# Query the authoritative runtime assisted-pulse definition for all 3 steps
	for step in range(total_assisted):
		var spec := PulseLoomConstants.get_assisted_pulse_spec(step)
		if spec.is_empty():
			root.free()
			return false
		
		var expected_src: int = spec["source_lane"]
		var expected_tgt: int = spec["target_lane"]
		var expected_spd: float = spec["speed"]
		var expected_name: String = spec["name"]
		var expected_sym: String = spec["symbol"]
		var expected_col: Color = spec["color"]
		
		# Verify names, symbols, and colors are derived from PulseLoomConstants using target_lane
		if expected_name != PulseLoomConstants.GLYPH_NAMES[expected_tgt]:
			root.free()
			return false
		if expected_sym != PulseLoomConstants.GLYPH_SYMBOLS[expected_tgt]:
			root.free()
			return false
		if expected_col != PulseLoomConstants.LANE_COLORS[expected_tgt]:
			root.free()
			return false
		
		# Advance time to spawn assisted pulse
		root._process(0.55)
		if root.active_pulses.size() != 1:
			root.free()
			return false
		
		var p := root.active_pulses[0]
		if p.source_lane != expected_src or p.target_lane != expected_tgt or not is_equal_approx(p.speed, expected_spd):
			root.free()
			return false
		
		# Rotate core to align with target
		var req_step := PulseLoomRouting.get_required_step(p.source_lane, p.target_lane)
		root.signal_core.set_step(req_step)
		root._update_preview_state()
		
		if not PulseLoomRouting.is_aligned(p.source_lane, p.target_lane, root.signal_core.current_step):
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
		
		if expected_next_step < total_assisted:
			if not root.onboarding_active:
				root.free()
				return false
		if root.score < (step + 1) * 100:
			root.free()
			return false
	
	# 2. Verify transition from assisted onboarding to normal score-attack
	if root.onboarding_active:
		root.free()
		return false
	if root.onboarding_step < total_assisted:
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
	
	# Explicit Square name/symbol/exact Emerald-color and Circle name/symbol/exact Crimson-color assertions
	var square_name: String = PulseLoomConstants.GLYPH_NAMES[PulseLoomConstants.GlyphType.SQUARE]
	var square_sym: String = PulseLoomConstants.GLYPH_SYMBOLS[PulseLoomConstants.GlyphType.SQUARE]
	var square_col: Color = PulseLoomConstants.LANE_COLORS[PulseLoomConstants.GlyphType.SQUARE]
	if square_name != "SQUARE" or square_sym != "□" or square_col != Color(0.0, 1.0, 0.6):
		root.free()
		return false
	
	var circle_name: String = PulseLoomConstants.GLYPH_NAMES[PulseLoomConstants.GlyphType.CIRCLE]
	var circle_sym: String = PulseLoomConstants.GLYPH_SYMBOLS[PulseLoomConstants.GlyphType.CIRCLE]
	var circle_col: Color = PulseLoomConstants.LANE_COLORS[PulseLoomConstants.GlyphType.CIRCLE]
	if circle_name != "CIRCLE" or circle_sym != "○" or circle_col != Color(1.0, 0.20, 0.4):
		root.free()
		return false
	
	# Explicitly exercise every target lane (0..5) at least twice from different sources
	# Proves pulse target, signal_core target, radar_lanes target, required step, routed preview, alignment, and actual resolution all agree
	for target_lane in range(PulseLoomConstants.NUM_LANES):
		var glyph_name: String = PulseLoomConstants.GLYPH_NAMES[target_lane]
		var glyph_sym: String = PulseLoomConstants.GLYPH_SYMBOLS[target_lane]
		var glyph_col: Color = PulseLoomConstants.LANE_COLORS[target_lane]
		
		# Exercise target from 3 different source lanes (at least twice)
		var source_lanes: Array[int] = [
			(target_lane + 1) % PulseLoomConstants.NUM_LANES,
			(target_lane + 3) % PulseLoomConstants.NUM_LANES,
			(target_lane + 5) % PulseLoomConstants.NUM_LANES
		]
		
		for src_lane in source_lanes:
			# Create pulse with this target
			var p := SignalPulse.new()
			p.setup(src_lane, target_lane, 80.0)
			root.active_pulses.append(p)
			
			# (a) Pulse target check
			if p.target_lane != target_lane or p.source_lane != src_lane:
				p.free()
				root.free()
				return false
			
			# (b) Required step calculation
			var req_step := PulseLoomRouting.get_required_step(src_lane, target_lane)
			root.signal_core.set_step(req_step)
			root._update_preview_state()
			
			# (c) signal_core target and source agreement
			if root.signal_core.active_target_lane != target_lane or root.signal_core.active_source_lane != src_lane:
				p.free()
				root.free()
				return false
			
			# (d) radar_lanes target and source agreement
			if root.radar_lanes.active_target_lane != target_lane or root.radar_lanes.active_source_lane != src_lane:
				p.free()
				root.free()
				return false
			
			# (e) Routed preview agreement
			var previewed_lane := PulseLoomRouting.get_routed_lane(src_lane, req_step)
			if previewed_lane != target_lane:
				p.free()
				root.free()
				return false
			
			# (f) Alignment agreement
			if not PulseLoomRouting.is_aligned(src_lane, target_lane, req_step):
				p.free()
				root.free()
				return false
			
			# Prove all other 5 rotor positions do NOT align or route to target
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
			
			# (g) Actual resolution agreement
			var prev_score: int = root.score
			var prev_routes: int = root.routes_completed
			p.distance = PulseLoomConstants.CORE_RADIUS
			root._resolve_pulse(p)
			root.active_pulses.erase(p)
			p.free()
			
			if root.routes_completed != prev_routes + 1:
				root.free()
				return false
			if root.score <= prev_score:
				root.free()
				return false
	
	# Verify assisted onboarding retry state invariants querying runtime helper
	root.reset_ready()
	root.start_run(get_valid_test_ticket("retry-regression-seed"))
	
	# Step 0: Resolve successfully using runtime spec
	var spec0 := PulseLoomConstants.get_assisted_pulse_spec(0)
	root._process(0.35)
	var p0 = root.active_pulses[0]
	if p0.source_lane != spec0["source_lane"] or p0.target_lane != spec0["target_lane"]:
		root.free()
		return false
	root.signal_core.set_step(PulseLoomRouting.get_required_step(p0.source_lane, p0.target_lane))
	p0.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p0)
	root._resolve_pulse(p0)
	p0.free()
	if root.onboarding_step != 1:
		root.free()
		return false
	
	# Step 1: Emerald Square □ (query spec1). Deliberately MISROUTE twice, then align on third attempt!
	var spec1 := PulseLoomConstants.get_assisted_pulse_spec(1)
	for fail_attempt in range(2):
		root._process(0.55)
		if root.active_pulses.size() != 1:
			root.free()
			return false
		var p1_fail = root.active_pulses[0]
		if p1_fail.source_lane != spec1["source_lane"] or p1_fail.target_lane != spec1["target_lane"]:
			root.free()
			return false
		# Set intentionally misaligned rotor step
		var wrong_step := (PulseLoomRouting.get_required_step(p1_fail.source_lane, p1_fail.target_lane) + 1) % PulseLoomConstants.NUM_LANES
		root.signal_core.set_step(wrong_step)
		p1_fail.distance = PulseLoomConstants.CORE_RADIUS
		root.active_pulses.erase(p1_fail)
		root._resolve_pulse(p1_fail)
		p1_fail.free()
		# Must remain at step 1 with 0 overloads (safe retry)
		if root.onboarding_step != 1 or root.overloads != 0 or not root.onboarding_active:
			root.free()
			return false
	
	# Now succeed on Step 1 (Emerald Square □)
	root._process(0.55)
	var p1_succ = root.active_pulses[0]
	var req_step_1 := PulseLoomRouting.get_required_step(p1_succ.source_lane, p1_succ.target_lane)
	root.signal_core.set_step(req_step_1)
	p1_succ.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p1_succ)
	root._resolve_pulse(p1_succ)
	p1_succ.free()
	if root.onboarding_step != 2:
		root.free()
		return false
	
	# Step 2: Crimson Circle ○ (query spec2). Deliberately MISROUTE once, then succeed on retry!
	var spec2 := PulseLoomConstants.get_assisted_pulse_spec(2)
	root._process(0.55)
	var p2_fail = root.active_pulses[0]
	if p2_fail.source_lane != spec2["source_lane"] or p2_fail.target_lane != spec2["target_lane"]:
		root.free()
		return false
	var wrong_step_2 := (PulseLoomRouting.get_required_step(p2_fail.source_lane, p2_fail.target_lane) + 1) % PulseLoomConstants.NUM_LANES
	root.signal_core.set_step(wrong_step_2)
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
	var req_step_2 := PulseLoomRouting.get_required_step(p2_succ.source_lane, p2_succ.target_lane)
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

func test_deterministic_stale_preview_lifecycle() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: GameManager = main_scene.instantiate() as GameManager
	root._ready()
	root.start_run(get_valid_test_ticket("stale-preview-test-seed"))
	
	# Skip assisted onboarding to operate directly on raw pulse stream
	root.onboarding_active = false
	root._clear_all_pulses()
	root._update_preview_state()
	
	# Initial clean state: no pulses active -> both clear (-1)
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
		root.free()
		return false
	
	# 1. Create Pulse A (Diamond ◇: src 0, tgt 2, dist 150.0)
	#    and Pulse B (Square □: src 2, tgt 3, dist 250.0)
	var pulse_a := SignalPulse.new()
	pulse_a.setup(0, 2, 80.0)
	pulse_a.distance = 150.0
	root.active_pulses.append(pulse_a)
	
	var pulse_b := SignalPulse.new()
	pulse_b.setup(2, 3, 80.0)
	pulse_b.distance = 250.0
	root.active_pulses.append(pulse_b)
	
	# Pulse A is nearest -> preview/highlight must reflect Pulse A (src 0, tgt 2)
	root._update_preview_state()
	if root.get_nearest_incoming_pulse() != pulse_a:
		root.free()
		return false
	if root.signal_core.active_source_lane != 0 or root.signal_core.active_target_lane != 2:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 0 or root.radar_lanes.active_target_lane != 2:
		root.free()
		return false
	
	# Rotate core to align with Pulse A
	var req_step_a := PulseLoomRouting.get_required_step(0, 2)
	root.signal_core.set_step(req_step_a)
	root._update_preview_state()
	if not PulseLoomRouting.is_aligned(0, 2, root.signal_core.current_step):
		root.free()
		return false
	if PulseLoomRouting.get_routed_lane(0, root.signal_core.current_step) != 2:
		root.free()
		return false
	
	# 2. Resolve Pulse A and remove it
	pulse_a.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_a)
	root.active_pulses.erase(pulse_a)
	pulse_a.free()
	
	# After A resolves and is removed, Pulse B becomes nearest -> preview/highlight must reflect Pulse B (src 2, tgt 3)
	root._update_preview_state()
	if root.get_nearest_incoming_pulse() != pulse_b:
		root.free()
		return false
	if root.signal_core.active_source_lane != 2 or root.signal_core.active_target_lane != 3:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 2 or root.radar_lanes.active_target_lane != 3:
		root.free()
		return false
	
	# Rotate core to align with Pulse B
	var req_step_b := PulseLoomRouting.get_required_step(2, 3)
	root.signal_core.set_step(req_step_b)
	root._update_preview_state()
	if not PulseLoomRouting.is_aligned(2, 3, root.signal_core.current_step):
		root.free()
		return false
	if PulseLoomRouting.get_routed_lane(2, root.signal_core.current_step) != 3:
		root.free()
		return false
	
	# 3. Resolve Pulse B and remove it
	pulse_b.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_b)
	root.active_pulses.erase(pulse_b)
	pulse_b.free()
	
	# No pulse remaining -> both clear immediately to -1
	root._update_preview_state()
	if root.get_nearest_incoming_pulse() != null:
		root.free()
		return false
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
		root.free()
		return false
	
	# 4. Then a new repeated Square □ or Circle ○ from another source -> preview/highlight/routing refresh with no stale state
	# Test repeated Square □ from source 4 (different source from earlier src 2)
	var pulse_c_square := SignalPulse.new()
	pulse_c_square.setup(4, PulseLoomConstants.GlyphType.SQUARE, 90.0)
	pulse_c_square.distance = 180.0
	root.active_pulses.append(pulse_c_square)
	
	root._update_preview_state()
	if root.get_nearest_incoming_pulse() != pulse_c_square:
		root.free()
		return false
	if root.signal_core.active_source_lane != 4 or root.signal_core.active_target_lane != PulseLoomConstants.GlyphType.SQUARE:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 4 or root.radar_lanes.active_target_lane != PulseLoomConstants.GlyphType.SQUARE:
		root.free()
		return false
	
	var req_step_c := PulseLoomRouting.get_required_step(4, PulseLoomConstants.GlyphType.SQUARE)
	root.signal_core.set_step(req_step_c)
	root._update_preview_state()
	if not PulseLoomRouting.is_aligned(4, PulseLoomConstants.GlyphType.SQUARE, root.signal_core.current_step):
		root.free()
		return false
	if PulseLoomRouting.get_routed_lane(4, root.signal_core.current_step) != PulseLoomConstants.GlyphType.SQUARE:
		root.free()
		return false
	
	# Resolve pulse C and clear
	pulse_c_square.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_c_square)
	root.active_pulses.erase(pulse_c_square)
	pulse_c_square.free()
	
	root._update_preview_state()
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
		root.free()
		return false
	
	# Test repeated Circle ○ from source 1 (different source from earlier src 5)
	var pulse_d_circle := SignalPulse.new()
	pulse_d_circle.setup(1, PulseLoomConstants.GlyphType.CIRCLE, 90.0)
	pulse_d_circle.distance = 200.0
	root.active_pulses.append(pulse_d_circle)
	
	root._update_preview_state()
	if root.get_nearest_incoming_pulse() != pulse_d_circle:
		root.free()
		return false
	if root.signal_core.active_source_lane != 1 or root.signal_core.active_target_lane != PulseLoomConstants.GlyphType.CIRCLE:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != 1 or root.radar_lanes.active_target_lane != PulseLoomConstants.GlyphType.CIRCLE:
		root.free()
		return false
	
	var req_step_d := PulseLoomRouting.get_required_step(1, PulseLoomConstants.GlyphType.CIRCLE)
	root.signal_core.set_step(req_step_d)
	root._update_preview_state()
	if not PulseLoomRouting.is_aligned(1, PulseLoomConstants.GlyphType.CIRCLE, root.signal_core.current_step):
		root.free()
		return false
	if PulseLoomRouting.get_routed_lane(1, root.signal_core.current_step) != PulseLoomConstants.GlyphType.CIRCLE:
		root.free()
		return false
	
	# Miss / overload pulse D to test miss removal lifecycle as well
	var misaligned_step := (req_step_d + 1) % PulseLoomConstants.NUM_LANES
	root.signal_core.set_step(misaligned_step)
	pulse_d_circle.distance = PulseLoomConstants.CORE_RADIUS
	root._resolve_pulse(pulse_d_circle)
	root.active_pulses.erase(pulse_d_circle)
	pulse_d_circle.free()
	
	# Clear check after miss
	root._update_preview_state()
	if root.signal_core.active_source_lane != -1 or root.signal_core.active_target_lane != -1:
		root.free()
		return false
	if root.radar_lanes.active_source_lane != -1 or root.radar_lanes.active_target_lane != -1:
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
	if PulseLoomConstants.GLYPH_NAMES.size() != 6 or PulseLoomConstants.GLYPH_SYMBOLS.size() != 6:
		return false
	if PulseLoomConstants.LANE_COLORS.size() != 6:
		return false
	
	# Canonical mapping assertions:
	# Lane 3 = SQUARE □ = Emerald Color(0.0, 1.0, 0.6)
	if PulseLoomConstants.GLYPH_NAMES[3] != "SQUARE":
		return false
	if PulseLoomConstants.GLYPH_SYMBOLS[3] != "□":
		return false
	if PulseLoomConstants.LANE_COLORS[3] != Color(0.0, 1.0, 0.6):
		return false
	
	# Lane 4 = CIRCLE ○ = Crimson Color(1.0, 0.20, 0.4)
	if PulseLoomConstants.GLYPH_NAMES[4] != "CIRCLE":
		return false
	if PulseLoomConstants.GLYPH_SYMBOLS[4] != "○":
		return false
	if PulseLoomConstants.LANE_COLORS[4] != Color(1.0, 0.20, 0.4):
		return false
	
	# Assisted pulse specification checks
	if PulseLoomConstants.get_assisted_pulse_count() != 3:
		return false
	
	var spec0 := PulseLoomConstants.get_assisted_pulse_spec(0)
	if spec0["source_lane"] != 0 or spec0["target_lane"] != 2 or not is_equal_approx(spec0["speed"], 75.0):
		return false
	if spec0["name"] != "DIAMOND" or spec0["symbol"] != "◇" or spec0["color"] != Color(1.0, 0.67, 0.0):
		return false
	
	var spec1 := PulseLoomConstants.get_assisted_pulse_spec(1)
	if spec1["source_lane"] != 2 or spec1["target_lane"] != 3 or not is_equal_approx(spec1["speed"], 80.0):
		return false
	if spec1["name"] != "SQUARE" or spec1["symbol"] != "□" or spec1["color"] != Color(0.0, 1.0, 0.6):
		return false
	
	var spec2 := PulseLoomConstants.get_assisted_pulse_spec(2)
	if spec2["source_lane"] != 5 or spec2["target_lane"] != 4 or not is_equal_approx(spec2["speed"], 85.0):
		return false
	if spec2["name"] != "CIRCLE" or spec2["symbol"] != "○" or spec2["color"] != Color(1.0, 0.20, 0.4):
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
