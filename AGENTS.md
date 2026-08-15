# Repository rules — 4444555.xyz

This file applies to every agent or developer working on this repository.

`CLAUDE.md` points here. `docs/WORKFLOW.md` is the current execution workflow and overrides the older per-task bureaucracy in `docs/ROADMAP.md` Part A wherever they conflict. The roadmap still defines technical phases, dependencies, gates, and intended work.

---

## Resume protocol

1. Read `AGENTS.md`, then `docs/WORKFLOW.md`, then the relevant phase in `docs/ROADMAP.md`.
2. Read `docs/PROJECT_STATE.md`, `README.md`, and task-relevant technical documents.
3. Inspect current `main` plus recent merged/open PRs before changing anything.
4. Repository history is authoritative when newer than documentation.
5. Do not ask the owner to repeat settled decisions.

---

## How the owner wants to work

The owner is Alex.

### Keep it practical

This is a browser-arcade project, not a safety-critical system. Use enough process to protect accepted work, CI, and production, but do not turn implementation into approval bureaucracy.

- The owner approves **phases**, not every internal task, commit, or PR.
- Once the owner says `proceed`, `go ahead`, or otherwise clearly approves a phase direction, complete that phase without asking for repeated implementation permission.
- Do not stop after every batch to ask whether to continue.
- Do not require a magic word such as `merge`. A clear positive verdict such as `OK`, `looks good`, `approved`, `go ahead`, or `merge` counts as phase approval.
- Internal non-player-visible work inside an already approved phase may be merged after CI is green without another owner approval.
- Player-visible work is reviewed once at the phase candidate stage through `https://4444555.xyz/test/`. A positive verdict on that candidate authorizes the phase merge.

### Deliver everything

Do the obvious next step without asking. Ask only when:

- the requested phase direction is genuinely ambiguous,
- an external owner-only action is required,
- completing the phase would materially change an accepted design decision that was not part of the approved direction,
- or a technical blocker prevents a reliable result.

### Be concise and honest

Short explanations. Never claim something is done, tested, deployed, or verified when it is not.

---

## Standing constraints

### Visual design

- Do not redesign the portal unless the owner explicitly asks.
- Preserve accepted Gravity Courier visual/control decisions unless new owner feedback changes them.
- New games must belong to the same premium design family without copying Gravity Courier's mechanics, geometry, or exact palette.
- Avoid crude browser-game presentation, excessive neon/bloom/fog/haze/chromatic aberration, noisy particles, giant HUDs, or accidental mobile visual degradation.

### Testing

- CI must be green before merging.
- Never disable or weaken a failing check just to get green.
- Every playable game must ultimately pass the shared desktop/mobile test matrix defined by the roadmap.
- Mobile controls and performance are first-class requirements.
- Use automated tests and gates as engineering tools, not as reasons to ask the owner for repeated approvals.

### Owner preview gate

For player-visible phase work, follow `docs/OWNER_PREVIEW_GATE.md`.

- Production `/` remains the accepted `main` build while review happens.
- `/test/` serves the exact candidate SHA.
- The owner tests the candidate there and gives one verdict for the phase.
- If rejected, fix the same phase branch and redeploy `/test/`; do not create a new approval ceremony for each internal fix.
- A positive verdict on the current candidate is merge authorization. No separate `merge` wording is required.

Pure documentation, tests, CI-only changes, and behaviour-preserving internal refactors do not need owner preview.

### Architecture

- Games should use `@4444555/game-sdk` boundaries as the hardening roadmap introduces them.
- Keep the portal usable without authentication and lazy-load heavy game code/assets.
- Preserve keyboard, touch, gamepad, reduced-motion, and muted-audio paths where applicable.
- Do not ship fake accounts, scores, or rankings.

### Security

- Never print, copy, log, or commit credentials or token files.
- Never commit secrets or private archives.

### Git

- Never develop directly on `main`.
- Use one branch/PR per **phase or coherent game milestone**, not one PR for every tiny internal task.
- Multiple commits and roadmap tasks may live in the same phase branch when they belong to the same approved outcome.
- Keep unrelated work out of the phase.
- Never rewrite shared `main` history.
- Merge only with green CI.
- Internal non-visible PRs within an approved phase may be merged by the agent without stopping for owner approval.
- The final player-visible phase candidate waits for `/test/` review and one owner verdict.

---

## Pull request requirements

PR bodies should be short and useful. Include only:

- phase/scope,
- important files or systems changed,
- verification/CI result,
- preview URL + exact SHA when player-visible,
- material risks or known limitations.

Do **not** require giant self-report templates, literal terminal transcripts, repeated allowlist declarations, or "rules I was tempted to break" sections unless a specific debugging/audit task genuinely needs them.

---

## Quick orientation

| Thing | Where |
| --- | --- |
| Current working method | `docs/WORKFLOW.md` |
| Technical phase plan | `docs/ROADMAP.md` |
| Frozen/accepted decisions | `docs/PROJECT_STATE.md` |
| Owner preview | `docs/OWNER_PREVIEW_GATE.md` |
| Game integration contract | `docs/GAME_SDK.md` |
| Add a game | `docs/CONTRIBUTING.md` |
| Deploy/rollback | `docs/DEPLOYMENT.md` |
