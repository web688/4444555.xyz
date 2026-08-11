# Gravity Courier — Production Gameplay Batch 1

Version: `0.15.0`  
Status: implemented production prototype

## Frozen run contract

- Duration: 120 seconds.
- Structure: four 30-second sectors.
- Route: deterministic UTC daily seed; retry repeats the same route.
- Difficulty: sector-based cruise speed, obstacle rotation, and obstacle spacing escalation.
- Failure: three hull points; zero hull ends the run immediately.
- Scoring: flight score multiplied by the current near-miss chain; collision resets the chain and removes 650 points.
- Chain: near misses increase the multiplier to a maximum of ×12.
- Completion: surviving to the relay records a delivery.

## Medals

| Medal | Requirement |
| --- | --- |
| Bronze | Complete the route. |
| Silver | Complete with at least 18,000 points. |
| Gold | Complete with at least 32,000 points and at least two hull remaining. |

Failed runs receive no medal but remain in recent history.

## Run result and persistence

Every completed or failed attempt records score, route date, duration, hull, sector reached, near misses, collisions, maximum multiplier, outcome, and medal.

The portal stores only anonymous device-local progress: best score, total runs, deliveries, and the eight newest results. Storage failure must never prevent gameplay. Accounts, global ranking, trusted claims, and cross-device sync are out of scope.

## Locked baseline

Production work preserves the accepted procedural background, crisp rendering, readable matte-white hazards with orange accents, direct controls, reduced foreground speed particles, adaptive high/balanced quality, reduced-motion behavior, mute path, and teardown.

## Verification

- `npm run typecheck`
- `npm test`
- production Vite build
- atomic Pages fallback regeneration and release-version alignment
- GitHub Actions before merge
- live cache-version check after deploy

The next owner review should focus on two-minute pacing, sector fairness, score/medal balance, failure clarity, retry speed, and portal history—not on reopening accepted visual decisions without a new observed issue.

## Mobile correction in 0.13

The gameplay contract is unchanged. Mobile/coarse-pointer devices receive a lower-cost render path: CSS-pixel starting resolution with an additional sustained-low-fps step, no extra glow/post-processing pass, reduced scene geometry and route-particle load, lower HUD update frequency, no live HUD backdrop blur, and non-reflective tunnel connectors. Obstacles use matte-white bodies on every tier while keeping orange warning accents.

## Obstacle colour correction in 0.14

The gameplay contract and mobile render path were unchanged. This attempt used `StandardMaterial.disableLighting`, but owner desktop review showed the bodies still rendered nearly black. Candidate 0.14 is not the accepted hazard-colour implementation.

## True unlit obstacle correction in 0.15

The gameplay contract and mobile render path remain unchanged. Obstacle bodies now use Babylon's PBR unlit surface path with true-white albedo, zero metallic response, and maximum roughness. Orange warning accents are unchanged; owner desktop confirmation remains required.
