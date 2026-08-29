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
	root._on_host_restart({})
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	
	# 2. Missing issuedAt should fail
	var no_issued := get_valid_test_ticket()
	no_issued.erase("issuedAt")
	if root.is_valid_ticket(no_issued):
		root.free()
		return false
	root.start_run(no_issued)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	root._on_host_restart(no_issued)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	# 3. Missing seed should fail
	var no_seed := get_valid_test_ticket()
	no_seed.erase("seed")
	if root.is_valid_ticket(no_seed):
		root.free()
		return false
	root.start_run(no_seed)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	root._on_host_restart(no_seed)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	# 4. Missing expiresAt should fail
	var no_expires := get_valid_test_ticket()
	no_expires.erase("expiresAt")
	if root.is_valid_ticket(no_expires):
		root.free()
		return false

	# 5. Missing other required fields
	for field in ["id", "gameId", "gameVersion", "ruleset", "signature"]:
		var missing_f := get_valid_test_ticket()
		missing_f.erase(field)
		if root.is_valid_ticket(missing_f):
			root.free()
			return false

	# 6. Wrong field types (non-string types must be rejected, not coerced)
	var int_seed := get_valid_test_ticket()
	int_seed["seed"] = 1337
	if root.is_valid_ticket(int_seed):
		root.free()
		return false
	root.start_run(int_seed)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	var int_id := get_valid_test_ticket()
	int_id["id"] = 12345
	if root.is_valid_ticket(int_id):
		root.free()
		return false

	var float_issued := get_valid_test_ticket()
	float_issued["issuedAt"] = 123456.78
	if root.is_valid_ticket(float_issued):
		root.free()
		return false

	var int_expires := get_valid_test_ticket()
	int_expires["expiresAt"] = 999999999
	if root.is_valid_ticket(int_expires):
		root.free()
		return false

	var bool_sig := get_valid_test_ticket()
	bool_sig["signature"] = true
	if root.is_valid_ticket(bool_sig):
		root.free()
		return false

	# 7. Empty string fields
	var empty_seed := get_valid_test_ticket()
	empty_seed["seed"] = ""
	if root.is_valid_ticket(empty_seed):
		root.free()
		return false

	var empty_id := get_valid_test_ticket()
	empty_id["id"] = ""
	if root.is_valid_ticket(empty_id):
		root.free()
		return false

	# 8. Missing/wrong prefix ID should fail
	var bad_id := get_valid_test_ticket()
	bad_id["id"] = "bad-id-123"
	if root.is_valid_ticket(bad_id):
		root.free()
		return false

	# 9. Wrong gameId should fail
	var bad_game := get_valid_test_ticket()
	bad_game["gameId"] = "other-game"
	if root.is_valid_ticket(bad_game):
		root.free()
		return false

	# 10. Wrong gameVersion should fail
	var bad_ver := get_valid_test_ticket()
	bad_ver["gameVersion"] = "0.2.0"
	if root.is_valid_ticket(bad_ver):
		root.free()
		return false

	# 11. Wrong ruleset should fail
	var bad_rules := get_valid_test_ticket()
	bad_rules["ruleset"] = "wrong-ruleset"
	if root.is_valid_ticket(bad_rules):
		root.free()
		return false

	# 12. Wrong signature should fail
	var bad_sig := get_valid_test_ticket()
	bad_sig["signature"] = "fake-sig"
	if root.is_valid_ticket(bad_sig):
		root.free()
		return false

	# 13. Invalid timestamp formats
	var bad_issued_ts := get_valid_test_ticket()
	bad_issued_ts["issuedAt"] = "invalid-date-string"
	if root.is_valid_ticket(bad_issued_ts):
		root.free()
		return false

	var bad_expires_ts := get_valid_test_ticket()
	bad_expires_ts["expiresAt"] = "not-a-datetime"
	if root.is_valid_ticket(bad_expires_ts):
		root.free()
		return false

	# 14. Expired timestamp should fail
	var expired := get_valid_test_ticket()
	expired["expiresAt"] = "2020-01-01T00:00:00.000Z"
	if root.is_valid_ticket(expired):
		root.free()
		return false
	root.start_run(expired)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	root._on_host_restart(expired)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	# 15. expiresAt <= issuedAt should fail
	var expires_before_issued := get_valid_test_ticket()
	expires_before_issued["issuedAt"] = "2030-01-01T12:00:00.000Z"
	expires_before_issued["expiresAt"] = "2030-01-01T11:00:00.000Z"
	if root.is_valid_ticket(expires_before_issued):
		root.free()
		return false
	root.start_run(expires_before_issued)
	if root.current_state != GameManager.State.READY:
		root.free()
		return false

	var expires_equal_issued := get_valid_test_ticket()
	expires_equal_issued["issuedAt"] = "2030-01-01T12:00:00.000Z"
	expires_equal_issued["expiresAt"] = "2030-01-01T12:00:00.000Z"
	if root.is_valid_ticket(expires_equal_issued):
		root.free()
		return false

	# 16. Valid ticket should pass and start_run transitions READY -> RUNNING
	var valid := get_valid_test_ticket("smoke-seed-42")
	if not root.is_valid_ticket(valid):
		root.free()
		return false

	root.start_run(valid)
	if root.current_state != GameManager.State.RUNNING:
		root.free()
		return false
	if root.seed_val != hash("smoke-seed-42"):
		root.free()
		return false
	if root.ticket_id != "run-pl-headless-smoke-001":
		root.free()
		return false

	# 17. Reset to READY and test _on_host_restart with valid ticket
	root.reset_ready()
	if root.current_state != GameManager.State.READY:
		root.free()
		return false
	
	var valid_restart := get_valid_test_ticket("restart-seed-99")
	valid_restart["id"] = "run-pl-headless-restart-002"
	root._on_host_restart(valid_restart)
	if root.current_state != GameManager.State.RUNNING:
		root.free()
		return false
	if root.ticket_id != "run-pl-headless-restart-002":
		root.free()
		return false
	if root.seed_val != hash("restart-seed-99"):
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
