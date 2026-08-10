# Project state — 4444555 Arcade

Updated: 2026-08-10, after owner acceptance of the Gravity Courier 0.8 background.

This is the durable handoff for continuing the project in a new conversation. Repository state is authoritative when it is newer than this document.

## Resume protocol

1. Work in `web688/4444555.xyz`; the default integration branch is `main` and the live site is `https://4444555.xyz/`.
2. Read `AGENTS.md`, this file, `README.md`, and the task-relevant documents before proposing or changing anything.
3. Inspect the latest `main` commit plus merged/open pull requests and issues. Reconcile any work newer than this handoff before continuing.
4. Preserve accepted behavior and decisions below. Do not make the user repeat settled project history.
5. Use the connected GitHub app only for repository work. The user does not want to operate a local checkout or relay implementation instructions.
6. Keep changes narrow, use a branch and pull request, run `npm run verify`, and do not describe a visual target as passed without the evidence required by `docs/VISUAL_REVIEW.md`.
7. Update this handoff whenever an accepted milestone materially changes the current state, settled decisions, or next step.

## Product intent

4444555 is a curated modern browser arcade for short, high-mastery sessions. It must include both the surrounding premium arcade website and the playable games. The visual target is modern and high quality, not pixel art or a generic prototype.

The platform must make it straightforward to add games and later show player scores, progress, achievements, saves, and improvement history attractively. GitHub Pages hosts the static portal and anonymous games. Accounts, trusted scores, global rankings, and cross-device persistence remain a later backend phase.

## Current implementation

- Portal: React 19, TypeScript, Vite, responsive GitHub Pages deployment with custom domain.
- Shared boundary: engine-neutral `@4444555/game-sdk` for lifecycle, player context, settings, scores, achievements, telemetry, and saves.
- 3D engine: Babylon.js 9.20.0 for Gravity Courier.
- Catalog:
  - Gravity Courier — playable visual candidate.
  - Echo Vector — concept.
  - Prism Siege — concept.
- Gravity Courier manifest: candidate `0.8.0`, status `visual-gate`.
- Source: `apps/portal/src/games/gravity-courier/`.
- Manifest: `catalog/manifests/gravity-courier.json`.
- Quality evidence: `docs/VISUAL_FEASIBILITY_GATE.md` and `docs/VISUAL_REVIEW.md`.

## Accepted decisions and owner feedback

### Controls

The current direct-control behavior is accepted and must be preserved:

- WASD and arrow keys steer.
- Pointer/touch drag and gamepad analog steering are supported.
- A direction reversal responds immediately.
- Releasing input stops lateral movement; there is no automatic recentring drift.
- Lost focus or visibility clears stuck input.
- Space, gamepad A, or trigger boosts.
- The former decorative reticle is now a functional flight-vector indicator tied to steering.

The accepted direct-control implementation came from PR #8 / commit `749497dbe2bdc64f8d58cb45962c6057aab59265`.

### Rendering clarity

The scene must remain sharp and readable. Whole-frame mist and blur were rejected. The accepted rendering direction keeps scene fog, full-screen bloom, FXAA, grain, and chromatic aberration disabled while retaining restrained object-local energy glow and device-aware resolution.

### Background

The owner accepted the current Gravity Courier 0.8 background on 2026-08-10: “it looks good the background.”

The background is procedurally generated at runtime in `createDeepSpaceBackdrop()` using a Babylon.js `DynamicTexture`. It paints the dark field, stars, stellar crosses, cyan/violet/amber nebula regions, and filaments, then maps the texture to an inward-facing sphere.

The owner asked whether it could later be replaced by an image and was told yes: a seamless 2:1 equirectangular panorama could replace the dynamic texture. No replacement has been requested. Do not change the accepted procedural background unless the user asks.

Candidate 0.7 introduced the richer background but accidentally added a near-white emissive base. Candidate 0.8 removed that additive emissive colour and restored black space and nebula contrast. The accepted baseline is PR #10 / commit `de07667c7b1ff6920f7a96923973021ffc27656b`.

## Repository state at this handoff

- Integration baseline inspected: `main@de07667c7b1ff6920f7a96923973021ffc27656b`.
- PRs #1 through #10 were merged.
- No open pull requests or issues existed at inspection time.
- The latest PR verification completed successfully.
- Root Pages fallback assets and the optimized Vite/Actions deployment are both versioned for candidate 0.8.0.

This handoff change itself will be newer than the gameplay baseline above. Future conversations must inspect recent GitHub history rather than assuming this SHA is still the repository head.

## Visual gate status

Gravity Courier is still a 30-second interactive feasibility slice, not a completed game. It includes steering, boost, obstacles, near misses, collisions, scoring, integrity, a relay finale, procedural sound, restart/teardown, adaptive high/balanced tiers, and keyboard/touch/gamepad support.

The visual gate remains formally pending until the review record contains named device/browser evidence for:

- desktop and mobile captures;
- reference comparison;
- stable 60 fps desktop and 30 fps mobile frame pacing;
- sound review;
- five lifecycle/restart cycles without leaked audio, listeners, canvas, or GPU resources.

Do not silently promote Gravity Courier into full production or mark the visual gate passed without the owner's direction and the required evidence.

## Workflow and communication constraints

- The user prefers concise answers and direct implementation.
- The user handles hosting setup only; repository work should be performed through the connected GitHub app.
- Do not make the user act as a copy-paste intermediary.
- For visual problems, use the user's current live-site feedback or screenshot as acceptance evidence; source inspection alone cannot establish visual approval.
- Preserve keyboard, touch, gamepad, reduced-motion, and muted-audio paths.
- Games must not import Firebase or write leaderboards directly.
- Keep the portal usable without authentication; do not ship fake accounts, scores, or leaderboards.

## What happens next

There is no pre-authorized implementation task after the accepted 0.8 background. Ask what the user wants to address next, then inspect the current repository state before acting. Do not reopen the accepted controls or background unless new feedback specifically requires it.
