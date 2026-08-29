# Authoritative routing logic helper for Pulse Loom
class_name PulseLoomRouting
extends RefCounted

const PulseLoomConstants = preload("res://scripts/constants.gd")

# Authoritative route mapping for a given source lane and rotor step (0..5)
static func get_routed_lane(source_lane: int, rotor_step: int) -> int:
	return posmod(source_lane + rotor_step, PulseLoomConstants.NUM_LANES)

# Calculate the rotor step (0..5) needed to connect source_lane to target_lane
static func get_required_step(source_lane: int, target_lane: int) -> int:
	return posmod(target_lane - source_lane, PulseLoomConstants.NUM_LANES)

# Check if current rotor_step successfully connects source_lane to target_lane
static func is_aligned(source_lane: int, target_lane: int, rotor_step: int) -> bool:
	return get_routed_lane(source_lane, rotor_step) == target_lane
