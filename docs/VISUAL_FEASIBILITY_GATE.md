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
