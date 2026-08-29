# Constants and configuration for Pulse Loom
class_name PulseLoomConstants
extends RefCounted

const NUM_LANES: int = 6
const LANE_ANGLE_STEP: float = PI / 3.0 # 60 degrees

const TOTAL_RUN_SECONDS: float = 90.0
const MAX_OVERLOADS: int = 3

const SPAWN_RADIUS: float = 300.0
const CORE_RADIUS: float = 65.0
const HIT_TOLERANCE_RADIUS: float = 24.0

const MEDAL_BRONZE_SCORE: int = 15000
const MEDAL_SILVER_SCORE: int = 35000
const MEDAL_GOLD_SCORE: int = 60000

# Glyph types for accessibility / non-color-only identification
enum GlyphType {
	HEXAGON = 0,
	TRIANGLE = 1,
	DIAMOND = 2,
	SQUARE = 3,
	CIRCLE = 4,
	CROSS = 5
}

const GLYPH_NAMES: Array[String] = [
	"HEXAGON",
	"TRIANGLE",
	"DIAMOND",
	"SQUARE",
	"CIRCLE",
	"CROSS"
]

const GLYPH_SYMBOLS: Array[String] = [
	"⬡",
	"△",
	"◇",
	"□",
	"○",
	"✕"
]

# Color palette with crisp contrast
const LANE_COLORS: Array[Color] = [
	Color(0.0, 0.94, 1.0),   # Cyan (#00f0ff)
	Color(0.69, 0.40, 1.0),  # Violet (#b066ff)
	Color(1.0, 0.67, 0.0),   # Amber (#ffaa00)
	Color(0.0, 1.0, 0.6),    # Emerald (#00ff99)
	Color(1.0, 0.20, 0.4),   # Crimson (#ff3366)
	Color(0.2, 0.6, 1.0)     # Azure (#3399ff)
]

# Canonical assisted onboarding pulse sequence:
# Step 0: 0 -> 2 (speed 75.0) -> Amber Diamond ◇
# Step 1: 2 -> 3 (speed 80.0) -> Emerald Square □
# Step 2: 5 -> 4 (speed 85.0) -> Crimson Circle ○
const ASSISTED_PULSE_SEQUENCE: Array[Dictionary] = [
	{ "source_lane": 0, "target_lane": 2, "speed": 75.0 },
	{ "source_lane": 2, "target_lane": 3, "speed": 80.0 },
	{ "source_lane": 5, "target_lane": 4, "speed": 85.0 }
]

static func get_assisted_pulse_count() -> int:
	return ASSISTED_PULSE_SEQUENCE.size()

static func get_assisted_pulse_spec(step: int) -> Dictionary:
	if step < 0 or step >= ASSISTED_PULSE_SEQUENCE.size():
		return {}
	var base: Dictionary = ASSISTED_PULSE_SEQUENCE[step]
	var tgt: int = base["target_lane"]
	return {
		"step": step,
		"source_lane": base["source_lane"],
		"target_lane": tgt,
		"speed": base["speed"],
		"name": GLYPH_NAMES[tgt],
		"symbol": GLYPH_SYMBOLS[tgt],
		"color": LANE_COLORS[tgt]
	}

static func get_lane_angle(lane_index: int) -> float:
	return (lane_index % NUM_LANES) * LANE_ANGLE_STEP

static func get_medal_for_score(score: int, completed: bool) -> String:
	if not completed and score < MEDAL_BRONZE_SCORE:
		return "none"
	if score >= MEDAL_GOLD_SCORE:
		return "gold"
	if score >= MEDAL_SILVER_SCORE:
		return "silver"
	if score >= MEDAL_BRONZE_SCORE:
		return "bronze"
	return "none"

