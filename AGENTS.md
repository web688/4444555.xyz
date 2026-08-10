# Repository rules

## Required resume protocol

- At the start of every new or resumed work session, read `docs/PROJECT_STATE.md` before planning or changing the project.
- Inspect the latest `main` commit plus recent merged/open pull requests and issues, then reconcile any repository activity newer than the handoff.
- Treat settled owner decisions in the handoff as binding unless new owner feedback explicitly changes them.
- Update `docs/PROJECT_STATE.md` whenever an accepted milestone materially changes the current state, decisions, or next step.

## Engineering constraints

- Never claim the visual target has been achieved without a captured, device-tested vertical slice and written review.
- Games communicate through `@4444555/game-sdk`; they must not import Firebase or write leaderboards directly.
- Keep the portal usable without authentication and progressively load games and heavy assets.
- Preserve keyboard, touch, gamepad, reduced-motion, and muted-audio paths.
- A game manifest and validation tests are required for every new title.
