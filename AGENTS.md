# Repository rules

## Required resume protocol

- At the start of every new or resumed work session, read `docs/ROADMAP.md` **in full** before planning or changing anything. It is the execution contract: it defines the current phase, the task allowlists, the machine-checkable gate for every task, and the eleven non-negotiable rules in Part A. Work that skips it is rejected regardless of quality.
- Then read `docs/PROJECT_STATE.md` before planning or changing the project.
- Inspect the latest `main` commit plus recent merged/open pull requests and issues, then reconcile any repository activity newer than the handoff.
- Treat settled owner decisions in the handoff as binding unless new owner feedback explicitly changes them.
- Update `docs/PROJECT_STATE.md` whenever an accepted milestone materially changes the current state, decisions, or next step.

## Engineering constraints

- Never claim the visual target has been achieved without a captured, device-tested vertical slice and written review.
- Games communicate through `@4444555/game-sdk`; they must not import Firebase or write leaderboards directly. (Enforced by `npm run check:boundary` from Roadmap Task 3.3. Until that task ships, this rule is aspirational — Gravity Courier does not yet conform.)
- Keep the portal usable without authentication and progressively load games and heavy assets.
- Preserve keyboard, touch, gamepad, reduced-motion, and muted-audio paths.
- A game manifest and validation tests are required for every new title.
- Every title must pass the shared per-game test suite on the full device matrix — desktop and mobile — before it is called playable. No exceptions, no "desktop looks fine".
- The portal's visual design is protected by a visual-regression baseline. A style change is a deliberate, owner-approved act, never a side effect.

## Delivery style

- Deliver everything you have to deliver, in one response. Never close with a withheld item, an offer to do the obvious next step, or a "one more thing — want me to?". If it is logically part of the job, do it and report it.
