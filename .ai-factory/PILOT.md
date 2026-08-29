# AI Factory Pilot — Godot game for 4444555.xyz

## Objective

Prove the AI-factory workflow end to end on a real project by creating a new, original Godot Web game for 4444555.xyz without using the owner as a copy/paste relay.

The factory loop is:

- ChatGPT Web: controller, architecture, GitHub implementation/review, correction, PR/CI coordination.
- GitHub: authoritative state and durable memory.
- Local Antigravity/Gemini: bounded local implementation/verification when Godot/Godot MCP is needed.
- External supervisor/watcher: deterministic lifecycle, result validation, retry bounds, child-process cleanup, and controller wake-up.
- Owner: only O2/O3 authority gates.

## Product direction

Build a compact original premium browser-arcade game in Godot using GDScript.

The controller may choose the exact game concept autonomously, provided it:
- fits the existing premium 4444555 design family without copying Gravity Courier mechanics;
- targets a short 1–2 minute session;
- is small enough to serve as a bounded factory pilot;
- supports keyboard, touch, and gamepad where practical;
- is designed for desktop and mobile Web export;
- does not redesign the portal.

This pilot does not replace Gravity Courier, Orbital Slingshot, or the open Hullwatch phase.

## Godot/Web technical direction

- Use Godot 4 with GDScript, not C#.
- Target the Compatibility renderer/WebGL 2 path.
- Prefer the normal single-threaded Web export unless evidence requires otherwise.
- Integrate with the portal through a narrow JavaScript/host adapter rather than letting the Godot game own platform state directly.
- Preserve the repository's engine-neutral game SDK trust/lifecycle boundary.
- Do not require privileged credentials inside the game.

## Repository constraints

- Integration branch: main.
- Production / remains on accepted main.
- Player-visible work must be deployed to https://4444555.xyz/test/ at the exact candidate SHA.
- Do not merge the player-visible phase until the owner accepts that exact /test/ candidate.
- Do not interfere with open PR #29 (Hullwatch) unless a direct integration conflict must be resolved.
- Read AGENTS.md and docs/WORKFLOW.md before acting; they override stale roadmap bureaucracy where they conflict.
- Repository history is authoritative when newer than docs.

## Factory control

- Control branch: factory/control
- Task mailbox: .ai-factory/next-task.json
- Durable pilot context: this file
- Each corrected task payload may reuse the same logical task_id; the watcher fingerprints the full payload.
- Local verification-only tasks must not change repository state unless allow_worker_edits=true is explicitly delegated.

## Pilot success criteria

The pilot is successful when all of the following are demonstrated:

1. Local readiness is proven: repository verification, Godot/Godot MCP, and Web export.
2. A bounded Godot game phase is created on a normal implementation branch/PR.
3. ChatGPT and the local worker complete at least one real correction loop without owner relay.
4. Godot Web export is integrated into the existing portal without redesigning it.
5. Existing repository verification and new integration-specific checks are green.
6. The exact candidate is deployed to /test/.
7. The owner receives one O2 playtest gate with the preview URL and exact SHA.
8. If accepted, the phase can be merged under the repository's normal owner-preview contract.
9. Factory logs show task handoffs and task-owned Godot MCP/node processes are reclaimed after local runs.

Until item 7, the owner should not be asked for routine technical decisions.
