# Headless deterministic smoke and integration test for Pulse Loom
extends SceneTree

const PulseLoomConstants = preload("res://scripts/constants.gd")
const SignalCore = preload("res://scripts/signal_core.gd")
const SignalPulse = preload("res://scripts/pulse.gd")
const GameManager = preload("res://scripts/game_manager.gd")

func _init() -> void:
	print("=== Pulse Loom Headless Deterministic Smoke Test ===")
	var success := true
	
	if not test_constants():
		push_error("[FAIL] test_constants")
		success = false
	else:
		print("[PASS] test_constants")
	
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
	
	if not test_routing_and_multiplier():
		push_error("[FAIL] test_routing_and_multiplier")
		success = false
	else:
		print("[PASS] test_routing_and_multiplier")
	
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
	return {
		"id": "run-pl-headless-smoke-001",
		"gameId": "pulse-loom",
		"gameVersion": "0.1.0",
		"ruleset": "conduit-v1",
		"signature": "local-unverified",
		"expiresAt": "2035-01-01T00:00:00Z",
		"seed": seed_str
	}

func test_ticket_validation() -> bool:
	var main_scene = load("res://scenes/main.tscn")
	var root: Node2D = main_scene.instantiate()
	
	# 1. Empty ticket should fail
	if root.is_valid_ticket({}):
		root.free()
		return false
	root.start_run({})
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	
	# 2. Missing/wrong prefix ID should fail
	var bad_id := get_valid_test_ticket()
	bad_id["id"] = "bad-id-123"
	if root.is_valid_ticket(bad_id):
		root.free()
		return false
	
	# 3. Wrong gameId should fail
	var bad_game := get_valid_test_ticket()
	bad_game["gameId"] = "other-game"
	if root.is_valid_ticket(bad_game):
		root.free()
		return false
	
	# 4. Wrong gameVersion should fail
	var bad_ver := get_valid_test_ticket()
	bad_ver["gameVersion"] = "0.2.0"
	if root.is_valid_ticket(bad_ver):
		root.free()
		return false
	
	# 5. Wrong ruleset should fail
	var bad_rules := get_valid_test_ticket()
	bad_rules["ruleset"] = "wrong-ruleset"
	if root.is_valid_ticket(bad_rules):
		root.free()
		return false
	
	# 6. Wrong signature should fail
	var bad_sig := get_valid_test_ticket()
	bad_sig["signature"] = "fake-sig"
	if root.is_valid_ticket(bad_sig):
		root.free()
		return false
	
	# 7. Expired timestamp should fail
	var expired := get_valid_test_ticket()
	expired["expiresAt"] = "2020-01-01T00:00:00Z"
	if root.is_valid_ticket(expired):
		root.free()
		return false
	
	# 8. Valid ticket should pass and start_run transitions to RUNNING
	var valid := get_valid_test_ticket()
	if not root.is_valid_ticket(valid):
		root.free()
		return false
	
	root.start_run(valid)
	if root.current_state != GameManager.State.RUNNING:
		root.free()
		return false
	
	root.free()
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
	# Test conduit routing mathematics
	# routed_lane = (source_lane + current_step) % 6
	# If source is 2 and target is 5: (2 + step) % 6 == 5 => step = 3
	var src := 2
	var tgt := 5
	var needed_step := posmod(tgt - src, PulseLoomConstants.NUM_LANES)
	if needed_step != 3:
		return false
	
	if (src + needed_step) % 6 != tgt:
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
	root.start_run(get_valid_test_ticket("999"))
	
	# Simulate 3 misroutes
	for miss in range(3):
		var p := SignalPulse.new()
		p.setup(0, 3, 100.0) # src 0, tgt 3
		root.signal_core.set_step(0) # routed = 0 != 3 (miss)
		p.distance = PulseLoomConstants.CORE_RADIUS
		root.active_pulses.append(p)
		root._resolve_pulse(p)
	
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
	root.start_run(get_valid_test_ticket("2026"))
	
	var dt: float = 0.05
	var sim_time: float = 0.0
	
	while sim_time < 91.0 and root.current_state == GameManager.State.RUNNING:
		# Auto-pilot agent rotates conduit to perfectly match oncoming pulses
		for p in root.active_pulses:
			if p.active and not p.resolved:
				var needed_step := posmod(p.target_lane - p.source_lane, PulseLoomConstants.NUM_LANES)
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
