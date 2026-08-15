# Owner Preview Gate

Player-visible phase work is not merged until the owner has reviewed the exact candidate build at:

`https://4444555.xyz/test/`

## What requires a preview

This gate applies to a phase that changes something a player can see, hear, control, or feel, including gameplay, scoring, controls, visuals, materials, lighting, effects, camera, HUD, portal UI, audio, rendering/performance behaviour, a new game, or promotion toward `playable: true`.

Pure documentation, tests, CI-only work, deployment plumbing, and behaviour-preserving internal refactors do not require owner preview unless the owner asks for one.

## Required preview contract

1. Production `https://4444555.xyz/` stays on accepted `main` while the candidate is reviewed.
2. `https://4444555.xyz/test/` serves the exact candidate SHA proposed as the phase result. A screenshot, CI artifact, local URL, or description is not a substitute.
3. The review report states the candidate SHA and preview URL.
4. The implementing agent completes the coherent phase candidate before requesting owner review; do not ask for approval after every internal batch.
5. If the owner rejects the candidate, continue on the same phase branch, redeploy `/test/`, and return with the improved candidate.
6. If the candidate SHA changes after a positive owner verdict, redeploy the new SHA before treating it as approved.
7. A clear positive verdict such as `OK`, `looks good`, `approved`, `go ahead`, or `merge` on the current candidate is the **single phase approval and merge authorization**. No separate magic-word confirmation is required.

## Deployment design requirement

The deployment hardening work must provide a repeatable preview path that preserves accepted production at `/` and publishes the active candidate under `/test/`. The preview mechanism must not require committing generated build artifacts to `main` and must not make an unapproved candidate the production root.

Only one player-visible candidate is reviewed at `/test/` at a time. This keeps the owner's review unambiguous without creating approval bureaucracy for internal development batches.
