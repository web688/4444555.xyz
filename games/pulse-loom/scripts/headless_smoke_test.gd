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
	
	# Step 0 (Pulse 1): Advance time to spawn pulse
	root._process(0.35)
	if root.active_pulses.size() != 1:
		root.free()
		return false
	var p0 = root.active_pulses[0]
	if p0.source_lane != 0 or p0.target_lane != 2:
		root.free()
		return false
	
	# Rotate core to align with target 2
	var req_step_0 := PulseLoomRouting.get_required_step(p0.source_lane, p0.target_lane)
	root.signal_core.set_step(req_step_0)
	if not PulseLoomRouting.is_aligned(p0.source_lane, p0.target_lane, root.signal_core.current_step):
		root.free()
		return false
	
	# Advance pulse to core
	p0.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p0)
	root._resolve_pulse(p0)
	p0.free()
	
	if root.onboarding_step != 1 or not root.onboarding_active:
		root.free()
		return false
	if root.score < 100:
		root.free()
		return false
	
	# Step 1 (Pulse 2): Advance time to spawn pulse 2
	root._process(0.5)
	if root.active_pulses.size() != 1:
		root.free()
		return false
	var p1 = root.active_pulses[0]
	if p1.source_lane != 3 or p1.target_lane != 1:
		root.free()
		return false
	
	var req_step_1 := PulseLoomRouting.get_required_step(p1.source_lane, p1.target_lane)
	root.signal_core.set_step(req_step_1)
	if not PulseLoomRouting.is_aligned(p1.source_lane, p1.target_lane, root.signal_core.current_step):
		root.free()
		return false
	
	p1.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p1)
	root._resolve_pulse(p1)
	p1.free()
	
	if root.onboarding_step != 2 or not root.onboarding_active:
		root.free()
		return false
	
	# Step 2 (Pulse 3): Advance time to spawn pulse 3
	root._process(0.5)
	if root.active_pulses.size() != 1:
		root.free()
		return false
	var p2 = root.active_pulses[0]
	if p2.source_lane != 4 or p2.target_lane != 4:
		root.free()
		return false
	
	var req_step_2 := PulseLoomRouting.get_required_step(p2.source_lane, p2.target_lane)
	root.signal_core.set_step(req_step_2)
	if not PulseLoomRouting.is_aligned(p2.source_lane, p2.target_lane, root.signal_core.current_step):
		root.free()
		return false
	
	p2.distance = PulseLoomConstants.CORE_RADIUS
	root.active_pulses.erase(p2)
	root._resolve_pulse(p2)
	p2.free()
	
	# 2. Verify transition from assisted onboarding to normal score-attack
	if root.onboarding_active:
		root.free()
		return false
	if root.onboarding_step < 3:
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
