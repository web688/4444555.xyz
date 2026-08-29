# Procedural audio generator and sound manager for Pulse Loom
class_name PulseAudio
extends Node

var muted: bool = false
var audio_player: AudioStreamPlayer
var playback: AudioStreamGeneratorPlayback
var sample_rate: float = 22050.0

func _ready() -> void:
	audio_player = AudioStreamPlayer.new()
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = sample_rate
	gen.buffer_length = 0.1
	audio_player.stream = gen
	add_child(audio_player)
	if not Engine.is_editor_hint() and DisplayServer.get_name() != "headless":
		audio_player.play()
		playback = audio_player.get_stream_playback() as AudioStreamGeneratorPlayback

func set_muted(is_muted: bool) -> void:
	muted = is_muted

func play_tone(freq: float, duration: float, volume: float = 0.2, decay: float = 12.0) -> void:
	if muted or playback == null:
		return
	var frames_to_fill := int(sample_rate * duration)
	var available := playback.get_frames_available()
	var count: int = min(frames_to_fill, available)
	for i in range(count):
		var t := float(i) / sample_rate
		var envelope := exp(-decay * t) * volume
		var val := sin(TAU * freq * t) * envelope
		playback.push_frame(Vector2(val, val))

func play_rotate() -> void:
	play_tone(440.0, 0.04, 0.15, 30.0)

func play_route_success(multiplier: int) -> void:
	var base_freq := 523.25 # C5
	var pitch_mult := 1.0 + (float(multiplier - 1) * 0.08)
	play_tone(base_freq * pitch_mult, 0.09, 0.22, 16.0)

func play_miss() -> void:
	play_tone(140.0, 0.18, 0.25, 10.0)

func play_overload_alert() -> void:
	play_tone(110.0, 0.28, 0.35, 6.0)

func play_stage_up() -> void:
	play_tone(880.0, 0.14, 0.2, 14.0)

func play_victory() -> void:
	play_tone(659.25, 0.35, 0.25, 8.0)
