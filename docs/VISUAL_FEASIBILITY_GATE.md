# Visual Feasibility Gate 01 — Gravity Courier

## Question

Can the team produce a 20–30 second interactive slice with the cinematic lighting, material quality, motion, effects, and sound density expected by the supplied reference while remaining clear and responsive in a browser?

## Slice

One orbital environment; one courier craft; launch, bank and boost; two obstacles; one near miss; one collision response; a multiplier burst; one result transition; complete sound pass.

## Pass criteria

- Art director and product owner accept a captured desktop and mobile run against the agreed mood board.
- Input-to-visible-response feels immediate; frame pacing is stable, not merely high average FPS.
- Desktop target: 60 fps at 1080p on the agreed mid-tier test GPU.
- Mobile target: stable 30 fps on the agreed three-year-old baseline device with graceful quality reduction.
- Initial interactive download ≤ 15 MB compressed; total slice assets ≤ 80 MB.
- Visual hierarchy remains readable with bloom/effects reduced and reduced-motion enabled.
- No unhandled console errors, GPU leaks after five restarts, or audio continuing after teardown.

If it fails, reduce scene breadth, particle density, texture resolution, and dynamic lights before changing the core fantasy. Do not build the full game until the gate is reviewed in writing.

## Candidate 0.2 evidence

Implemented in the portal behind an explicit launch action:

- procedural courier craft and exhaust;
- moving orbital rings, hazards, starfield, planet and moon;
- steering, boost, near-miss multipliers, collision damage and camera response;
- 30-second route, score, pause, restart, keyboard/touch controls and procedural audio;
- high and balanced render tiers plus reduced-motion behavior;
- lazy loading plus direct Babylon module imports: the normal portal bundle remains approximately 64.5 KB gzip; the primary visual-gate chunk is approximately 375 KB gzip.

The candidate has passed strict TypeScript, contract tests, and the production build. It has **not** passed this visual gate until reference comparison, frame-time capture, audio review, and physical-device tests are attached to a review.

## Candidate 0.3 polish pass

- adds gamepad steering and boost alongside keyboard and pointer controls;
- displays measured FPS and the active render tier in the HUD;
- automatically drops from high to balanced after sustained sub-47 FPS rendering;
- adds a shield impact shell, brighter near-miss response, richer rotating hazards and in-world event callouts;
- introduces a multi-ring relay structure that approaches during the final route segment.

Automatic downgrading is a safety net, not performance approval. Physical-device frame-time evidence remains mandatory.
