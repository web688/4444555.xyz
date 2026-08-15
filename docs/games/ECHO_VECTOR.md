# Echo Vector — first playable phase

Echo Vector is a compact top-down temporal-action game built around six deterministic 30-second cycles. The player authors one movement/Phase tape per cycle; every completed tape replays at the same simulation tick in every later cycle. Cycle six therefore contains the current player plus five prior echoes.

## Player loop

- Move toward the resonance devices that wake on a lenient rhythmic cue.
- Phase near a ready device to activate it; old echoes can activate the same devices from their recorded routes.
- Controlled intersections while Phased create Confluence bonuses. Uncontrolled crossings damage Coherence and break the chain.
- Complete six cycles, improving the usefulness of the choreography rather than merely surviving the current moment.

## Scoring

Score combines node activations, timing accuracy, chains, echo-only assists, multi-actor activations, controlled Confluence crossings, and an end-of-run Echo Efficiency/Coherence bonus. Two, three, and four-or-more simultaneous actors are recorded as Duet, Trio, and Chorus events.

## Inputs

- Desktop: WASD/arrows move; Space phases. Mouse movement targets the shard and click phases.
- Gamepad: left stick moves; A or RT phases.
- Mobile: direct thumb movement on the left; Phase control on the right.
- Escape exits. Focus/visibility loss clears held input and visibility loss pauses simulation ticks.

Movement is direct rather than smoothed: reversal is immediate and releasing digital/touch input creates no recentering drift.

## Accessibility and restraint

Reduced-motion mode retains state/opacity cues while removing most pulse expansion/rotation. Sound is optional and procedural. The HUD is deliberately sparse: score/chain, cycle/Coherence, and the temporal sequence.

## Renderer and asset budget

The deterministic simulation is renderer-independent. PixiJS 8.18.1 is loaded only when Echo Vector is launched; the arena itself is procedural, with no texture/audio asset payload. The candidate uses a pinned production ESM build so the accepted portal entry bundle and Gravity Courier remain untouched.

Mobile lowers render resolution, antialiasing, and temporal-trail density. Trail data is downsampled and redrawn at a reduced cadence; nodes, actors, HUD geometry, and effects are persistent pooled objects rather than rebuilt each frame.

## Intentionally incomplete in this candidate

The first owner-preview candidate proves the game itself: deterministic echoes, six cycles, scoring, Coherence, all requested control paths, pause/restart/mute, and the target visual language. Device-local career history, medals, achievements UI, account sync, trusted score submission, and global rankings are intentionally deferred. The repository's broader hardening roadmap still lacks its planned six-device Playwright suite and SDK/budget enforcement on current `main`; those gates must not be falsely claimed as complete.
