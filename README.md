# 4444555 Arcade

A premium browser-arcade foundation: a fast React portal, an engine-neutral game SDK, a validated game manifest, and an explicit visual-quality gate before full production.

## Start

```bash
npm install
npm run dev
```

Run `npm run verify` before submitting changes.

## Current scope

- Static portal deployable to GitHub Pages
- Three differentiated game concepts
- Shared contracts for identity, lifecycle, scores, achievements, telemetry, settings, and saves
- Firebase-ready boundaries without coupling games to Firebase
- Accessibility, responsive layouts, reduced motion, and asset budgets

The first game, **Gravity Courier**, remains in `visual-gate` status. The portal now contains a lazy-loaded 30-second Babylon.js visual candidate with flight controls, procedural audio, scoring, collisions, adaptive rendering tiers, and restart/teardown. Production gameplay begins only after this slice is captured and accepted against the criteria in `docs/VISUAL_FEASIBILITY_GATE.md` on physical desktop and mobile devices.
