# Project state — 4444555 Arcade

Updated: 2026-08-11, true unlit obstacle correction (`0.15.0`).

This is the durable handoff for continuing the project in a new conversation. Repository history is authoritative when it is newer than this document.

## Resume protocol

1. Work in `web688/4444555.xyz`; the integration branch is `main` and the live site is `https://4444555.xyz/`.
2. Read `AGENTS.md`, this file, `README.md`, and the task-relevant documents.
3. Inspect the newest `main` commit, pull requests, issues, and Actions result before changing anything.
4. Preserve the accepted decisions below. Do not ask the owner to repeat settled history.
5. Use the connected GitHub app for repository work. The owner handles hosting setup, not source relays.
6. Keep changes narrow, use a branch and pull request, run `npm run verify`, merge only after CI passes, and verify the live deployment.
7. Update this handoff whenever an accepted milestone changes the current state or next step.

## Product intent

4444555 is a curated modern browser arcade for short, high-mastery sessions. It includes a premium responsive portal and real playable games. GitHub Pages hosts the static anonymous experience. Accounts, cross-device persistence, trusted scores, and global rankings remain a later backend phase.

Do not start a second playable game until Gravity Courier is a convincing real game.

## Current implementation

- Portal: React 19, TypeScript, Vite, responsive GitHub Pages deployment with custom domain.
- Shared boundary: engine-neutral `@4444555/game-sdk` for lifecycle, player context, settings, score claims, achievements, telemetry, and saves.
- Gravity Courier: Babylon.js 9.20.0, manifest `0.15.0`, status `prototype`, Production Gameplay Batch 1.
- Other catalog entries: Echo Vector and Prism Siege remain concepts.
- Source: `apps/portal/src/games/gravity-courier/`.
- Manifest: `catalog/manifests/gravity-courier.json`.
- Production contract: `docs/PRODUCTION_GAMEPLAY_BATCH_1.md`.

## Accepted and frozen visual/gameplay decisions

### Controls

- WASD and arrows steer; pointer/touch drag and gamepad analog steering are supported.
- Reversals respond immediately.
- Releasing input stops lateral movement; there is no automatic recentring drift.
- Lost focus or visibility clears input.
- Space, gamepad A, or trigger boosts.
- The flight-vector indicator is tied to actual steering.

### Rendering clarity and background

- The image must stay sharp. Whole-frame mist and blur were rejected.
- Scene fog, full-screen bloom, FXAA, grain, and chromatic aberration remain disabled.
- The owner accepted the current procedural background on 2026-08-10.
- `createDeepSpaceBackdrop()` paints stars, stellar crosses, cyan/violet/amber nebula regions, and filaments into a Babylon.js `DynamicTexture` mapped to an inward-facing sphere.
- It can later be replaced by a seamless 2:1 equirectangular image, but no replacement is requested. Do not change the accepted background without owner direction.

### Hazards

- The owner reported that the former near-black obstacle bodies were visible only at close range. This was a defect, not an intended fade.
- Candidate 0.9 changed hazards to lighter cool gunmetal while retaining orange warning accents. The owner accepted the visibility correction as “much better.”
- On 2026-08-11 the owner requested matte-white obstacle bodies. Candidate 0.13 removed specular reflection, but desktop lighting still made the bodies appear dark until the player approached.
- Candidate 0.14 attempted to use `StandardMaterial.disableLighting`; the owner's desktop screenshot showed that obstacle bodies still rendered nearly black. Babylon's standard shader removes the diffuse light contribution in that mode, so a non-emissive standard material did not retain its white diffuse colour.
- Candidate 0.15 instead uses `PBRMaterial.unlit` with a true-white albedo, zero metallic response, and maximum roughness. This is the renderer's actual unlit surface path and does not rely on emissive glow. Orange warning accents remain unchanged.

### Foreground speed particles

- Candidate 0.10 route particles looked like snowflakes and obscured the route.
- Candidate 0.11 reduced capacity, emission, size, opacity, warmth, and boost amplification while leaving the accepted procedural background unchanged.
- On 2026-08-10 the owner confirmed the reduced particles were acceptable and authorized the first production gameplay batch. This particle treatment is now frozen unless later playtesting identifies a new problem.

## Visual gate disposition

The owner completed three candidate 0.10 runs on desktop and three on mobile, accepted the corrected 0.11 visuals, chose to skip screenshot collection, and explicitly authorized production gameplay.

This is owner approval to leave the feasibility-slice phase. It is not a claim that named-device 60 fps desktop / 30 fps mobile performance certification was completed. The missing screenshots and numeric performance record are documented as waived for the production transition in `docs/VISUAL_REVIEW.md`.

## Production Gameplay Batch 1

Candidate `0.12.0` replaced the 30-second visual slice with:

- a ready/launch state and 120-second route;
- four 30-second sectors with increasing cruise speed, obstacle rotation, and route density;
- a deterministic daily route seed;
- three hull points and real failure at zero hull;
- near-miss chains up to ×12, score penalties on collision, and run stats;
- bronze, silver, and gold delivery medals;
- instant retry with the same daily route;
- device-local best score, total runs, deliveries, and the eight most recent runs;
- a portal flight record that updates when a run ends;
- preserved adaptive high/balanced rendering, controls, procedural audio, cleanup, accepted background, hazards, and restrained foreground particles.

Local progress is intentionally anonymous and device-only. Do not present it as a global leaderboard or account sync.

## Candidate 0.13 mobile correction

On 2026-08-11 the owner reported severe mobile stutter and distracting light reflections on the connectors of the tunnel circles. Candidate `0.13.0` addresses the render path rather than changing controls or route logic:

- coarse-pointer/mobile devices always start in the balanced tier at CSS-pixel resolution instead of up to 1.5× resolution;
- sustained sub-28 fps automatically reduces render resolution again;
- the extra glow pass and default post-processing pipeline are disabled on mobile while emissive energy materials remain;
- mobile ring, relay, planet and backdrop geometry is reduced without changing the composition;
- mobile route particles use 72 capacity and 18 emissions per second;
- HUD telemetry drops from 20 to roughly 8 updates per second and frame evidence samples at 10 Hz;
- live `backdrop-filter` blur is removed over the WebGL canvas on coarse-pointer devices;
- mobile tunnel connectors and relay metal use non-reflective matte material, and the mobile relay point light is disabled;
- obstacle bodies are matte white on every tier, with orange warning accents unchanged.

The owner must test the deployed correction on the same mobile device before mobile frame pacing can be considered improved or accepted.

## Candidate 0.14 obstacle colour correction

On 2026-08-11 the owner reported that desktop obstacle bodies only became white at close range. The cause was diffuse scene-light attenuation on the candidate 0.13 material. Candidate `0.14.0` disables lighting only on obstacle-body material, keeping those bodies consistently matte white at every distance without adding emissive glow. Orange warning strips, tunnel materials, mobile performance settings, controls, route logic, procedural background, and restrained particles are unchanged.

The owner's deployed desktop screenshot showed that this correction failed: candidate 0.14 obstacle bodies remained nearly black. Do not treat candidate 0.14 as an accepted hazard-colour baseline.

## Candidate 0.15 true unlit obstacle correction

Candidate `0.15.0` replaces the failed standard material with Babylon's PBR unlit path. Obstacle bodies use `Color3.White()` albedo, metallic `0`, roughness `1`, and `unlit = true`. The change is limited to obstacle bodies; orange warning strips, tunnel materials, mobile performance settings, controls, route logic, procedural background, and restrained particles remain unchanged. Owner desktop confirmation is required before accepting the colour correction.

## Workflow and communication constraints

- The owner prefers concise answers and direct implementation.
- Do not make the owner a copy/paste intermediary.
- Preserve keyboard, touch, gamepad, reduced-motion, and muted-audio paths.
- Games must not import Firebase or write leaderboards directly.
- Keep the portal usable without authentication; do not ship fake accounts, scores, or rankings.
- Use an atomic Git tree/commit for releases containing the split Pages fallback assets so CI never sees a partial bundle.

## Phase 0 — Hygiene and readable baseline

On 2026-08-11, Phase 0 was completed and certified:
- Task 0.1: Local secrets (`GIT_Token.txt`, `all connection info.txt`, `*.zip`) quarantined in `.gitignore`.
- Task 0.2: Line ending normalization (`* text=auto eol=lf`) locked via `.gitattributes`.
- Task 0.3: Baseline recorded in `docs/BASELINE.md` for commit `5231a8d`.

## What happens next

Phase 0 is complete. Next is **Phase 1 — One deployment path**:
- Task 1.1: Determine and document the live path (`docs/DEPLOYMENT.md`).
- **Owner Action Item O4 required for Task 1.1**: Alex to report the GitHub Pages source setting (Settings → Pages → Build and deployment): "GitHub Actions" or "Deploy from a branch".

