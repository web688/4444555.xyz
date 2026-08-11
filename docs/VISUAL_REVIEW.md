# Gravity Courier visual review record

Candidate: `0.14.0`  
Reference: user-supplied YouTube sequence around 03:40  
Status: **owner accepted visual direction; performance capture waived for production transition**

## Owner disposition

The owner accepted direct controls, the candidate 0.8 procedural background, the candidate 0.9 hazard visibility correction, and the candidate 0.11 foreground-particle reduction.

The owner completed three candidate 0.10 runs on desktop and three on mobile. End-of-run report screenshots, named devices/browsers, and numeric frame-pacing values were not supplied. The owner then chose to skip screenshots and explicitly authorized Production Gameplay Batch 1.

This authorization closes the visual-feasibility phase by owner direction. It does not manufacture missing performance evidence or certify specific frame-rate targets.

## Review matrix

| Dimension | Result |
| --- | --- |
| Composition | Owner accepted the procedural background and route presentation. |
| Controls/motion | Owner accepted the direct steering behavior after repeated desktop and mobile runs. |
| Hazard readability | Candidate 0.14 keeps matte-white bodies at a constant colour across distance; orange warning accents remain. Owner desktop confirmation pending. |
| Foreground effects | Candidate 0.10 failed because particles resembled a snowstorm; candidate 0.11 reduction accepted. |
| Sound | No formal headphone/mobile-speaker record supplied. |
| Desktop performance | Three routes completed; named device/browser and numeric report not supplied. |
| Mobile performance | Three routes completed; named device/browser and numeric report not supplied. |
| Lifecycle | No formal five-cycle resource-growth record supplied. |

## Frozen visual baseline for production

- Crisp scene with full-screen fog, bloom, FXAA, grain, and chromatic aberration disabled.
- Procedural `DynamicTexture` deep-space backdrop remains unchanged.
- Unlit, non-emissive matte-white hazard bodies retain orange warning accents and do not change colour with distance lighting.
- Mobile tunnel connectors use non-reflective matte material; the mobile relay light is disabled to prevent flashing reflections.
- `route-stars` remains restrained at 280/140 capacity, 72/34 emission, `0.052` maximum size, low alpha, cool colour, and `1.12` boost amplification.
- Accepted direct controls and flight-vector response remain unchanged.

Any later visual change requires a specific playtest finding or owner request.

## Candidate 0.13 review focus

The owner reported severe stutter and reflective tunnel-circle connectors on mobile, and requested matte-white obstacles. Candidate 0.13 introduces a dedicated coarse-pointer render path and the requested materials. These changes are implemented but remain pending owner review on the affected mobile device; no mobile-performance pass is claimed from source inspection.

## Candidate 0.14 review focus

The owner reported that candidate 0.13 obstacle bodies still appeared dark on desktop until the player approached. Candidate 0.14 makes only the body material unlit and non-emissive, producing a stable matte-white colour at every distance without glow. One desktop run should confirm the correction; the mobile performance review remains pending.
