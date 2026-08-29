# Web bridge interface for communicating with 4444555 portal host
class_name WebBridge
extends Node

signal host_start_requested(ticket: Dictionary)
signal host_pause_requested()
signal host_resume_requested()
signal host_restart_requested(ticket: Dictionary)
signal host_settings_changed(settings: Dictionary)

var _js_callback: JavaScriptObject

func _ready() -> void:
	if OS.has_feature("web"):
		_setup_web_listeners()
	# Notify host that game engine is loaded and ready
	call_deferred("send_game_ready")

func _setup_web_listeners() -> void:
	_js_callback = JavaScriptBridge.create_callback(_on_js_message_raw)
	var win = JavaScriptBridge.get_interface("window")
	if win:
		win._godot_pulse_loom_receiver = _js_callback
		JavaScriptBridge.eval("""
		(function() {
			if (window._pulse_loom_listener_installed) return;
			window._pulse_loom_listener_installed = true;
			window.addEventListener('message', function(event) {
				if (event.source !== window.parent) return;
				if (!event.origin || event.origin === 'null' || event.origin === '*' || event.origin !== window.location.origin) return;
				if (!event.data) return;
				try {
					var payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
					if (payload && typeof payload === 'object' && !Array.isArray(payload) && typeof payload.type === 'string' && window._godot_pulse_loom_receiver) {
						window._godot_pulse_loom_receiver(JSON.stringify(payload));
					}
				} catch(e) {
					console.error('[PulseLoom Bridge Error]', e);
				}
			});
		})();
		""")

func _on_js_message_raw(args: Array) -> void:
	if args.is_empty():
		return
	var raw = args[0]
	var json_str := str(raw)
	var parsed = JSON.parse_string(json_str)
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	handle_command(parsed)

func handle_command(cmd: Dictionary) -> void:
	if not cmd.has("type") or typeof(cmd["type"]) != TYPE_STRING:
		return
	var msg_type: String = cmd["type"]
	match msg_type:
		"START":
			if cmd.has("ticket") and typeof(cmd["ticket"]) == TYPE_DICTIONARY:
				host_start_requested.emit(cmd["ticket"])
		"PAUSE":
			host_pause_requested.emit()
		"RESUME":
			host_resume_requested.emit()
		"RESTART":
			if cmd.has("ticket") and typeof(cmd["ticket"]) == TYPE_DICTIONARY:
				host_restart_requested.emit(cmd["ticket"])
		"SET_SETTINGS", "INIT":
			if cmd.has("settings") and typeof(cmd["settings"]) == TYPE_DICTIONARY:
				host_settings_changed.emit(cmd["settings"])

func send_to_host(msg: Dictionary) -> void:
	if OS.has_feature("web"):
		var json_str := JSON.stringify(msg)
		var escaped := json_str.replace("\\", "\\\\").replace("'", "\\'")
		JavaScriptBridge.eval("""
		(function() {
			if (window.parent && window.parent !== window && window.location.origin && window.location.origin !== 'null' && window.location.origin !== '*') {
				window.parent.postMessage(JSON.parse('""" + escaped + """'), window.location.origin);
			}
		})();
		""")

func send_game_ready() -> void:
	send_to_host({
		"type": "GAME_READY",
		"game": "pulse-loom",
		"version": "0.1.0",
		"sdk": "0.1.0",
		"engine": "Godot 4.6.3"
	})

func send_state_change(state: String) -> void:
	send_to_host({
		"type": "STATE_CHANGE",
		"state": state
	})

func send_telemetry(data: Dictionary) -> void:
	send_to_host({
		"type": "TELEMETRY",
		"data": data
	})

func send_run_ended(data: Dictionary) -> void:
	send_to_host({
		"type": "RUN_ENDED",
		"data": data
	})
