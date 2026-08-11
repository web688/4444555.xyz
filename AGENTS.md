# Repository rules — 4444555.xyz

This file is the entry point for **every** agent working on this repository, regardless of which
model or tool you are. It is not addressed to any one assistant. If you are reading this, it
applies to you.

`CLAUDE.md` is a pointer to this file. There is one set of rules, and it lives here.

---

## Required resume protocol

1. **Read `docs/ROADMAP.md` in full before planning or changing anything.** It is the execution
   contract: current phase, per-task file allowlists, the machine-checkable gate for every task,
   and the thirteen non-negotiable rules in Part A. Work that skips it is rejected regardless of
   quality.
2. Read this file, then `docs/PROJECT_STATE.md`, then `README.md`, then the task-relevant
   documents.
3. Inspect the latest `main` commit plus recent merged and open pull requests and issues, then
   reconcile any repository activity newer than the handoff.
4. Treat settled owner decisions in `docs/PROJECT_STATE.md` as binding unless new owner feedback
   explicitly changes them. Do not ask the owner to repeat settled history.
5. Update `docs/PROJECT_STATE.md` whenever an accepted milestone materially changes the current
   state, decisions, or next step.

Repository history is authoritative when it is newer than any document.

---

## How the owner wants to be worked with

The owner is Alex. These are working-style requirements, not preferences to weigh against other
goals.

### Deliver everything, every time

Never end a response with a withheld item. No "one more thing", no "I also noticed X — want me to
fix it?", no "optionally I could…", no closing question about something that was obviously part
of the job. If it follows logically from the request, **do it and report it as done.**

Asking permission for the self-evident wastes a round trip and reads as hedging. A response that
ends by offering to do the next obvious step has not finished the work.

The only legitimate reasons to stop and ask are Roadmap rules 3 and 6:

- you need to touch a file outside the current task's allowlist, or
- a gate has failed twice.

Those are escalations. Everything else is hesitation, and hesitation is not wanted.

### Be concise and direct

Short explanations. Cut every word that carries no information. If you can delete a sentence and
the meaning survives, delete it.

### Answer the question that was asked, honestly, first

If a plan has a gap, say "no, that's missing" plainly. Do not reframe a gap as a deliberate
scoping decision. Do not bury a negative answer under context. Lead with the answer, then
explain.

Never claim something is done, tested, or verified when it is not. "It should work" is not
"it works". If you have not run it, say you have not run it.

### Ask before writing code

Planning, reading, research, analysis, and documentation need no permission. **Changing
application code does.** Get agreement on the approach first.

---

## Standing constraints

### Visual design

- **Do not change the portal's visual design.** `apps/portal/src/styles.css`, the hero, the orbit
  stage, the card grid, the type scale, the colour palette, and the site copy are accepted owner
  work. They appear in no task allowlist in Roadmap Phases 0–5.
- The design is protected by a visual-regression baseline (Roadmap Task 2.5). A style change is a
  deliberate, owner-approved act with regenerated baselines in a PR titled `design:` — never a
  side effect of other work.
- Do not reopen the frozen visual and gameplay decisions in `docs/PROJECT_STATE.md` — the
  procedural deep-space backdrop, direct controls with no recentring drift, matte-white PBR-unlit
  hazards with orange accents, restrained foreground particles, and the crisp no-fog/no-bloom
  render — without a specific new playtest finding or an explicit owner request.

### Testing

- **Every game ships tested on desktop and mobile.** Six Playwright device projects: Chromium,
  Firefox and WebKit on desktop; iPhone, Pixel, and Pixel-portrait on mobile. No exceptions, no
  "desktop looks fine", no trimming the matrix to make CI faster.
- Mobile regressions must be caught by CI, not by the owner on his phone. Every expensive bug in
  this project's history was a mobile bug found by hand after release.
- A title cannot be marked `playable: true` in `catalog.ts` until the shared `runGameSuite`
  passes for it on all six device projects.
- A game manifest and validation tests are required for every new title.
- Never claim the visual or performance target has been achieved without captured, device-tested
  evidence and a written review.

### Architecture

- Games communicate through `@4444555/game-sdk`. They must not import Firebase, write leaderboards
  directly, or reach `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, or `fetch`.
  *(Enforced by `npm run check:boundary` from Roadmap Task 3.3. Until that task ships this rule is
  aspirational — Gravity Courier does not yet conform. Do not cite it as if it were already true.)*
- Keep the portal usable without authentication, and progressively load games and heavy assets.
- Preserve keyboard, touch, gamepad, reduced-motion, and muted-audio paths in everything.
- Do not ship fake accounts, scores, or rankings. Local progress is anonymous and device-only and
  must never be presented as a leaderboard.

### Security

- Never print, echo, log, copy, or commit the contents of `GIT_Token.txt` or
  `all connection info.txt`. Not into a file, a commit message, a PR body, a test fixture, or a
  chat message.
- Never commit credentials, tokens, or archives.

### Git

- One task per branch, one task per pull request. Never combine two task IDs.
- Never rewrite history on `main`: no `push --force`, no rebase of pushed commits, no
  `reset --hard` on a shared branch, no amending a pushed commit.
- Run `npm run verify` before opening a pull request. Merge only after CI passes.
- Never disable, skip, or weaken a failing check to get green. Not with `|| true`, not with
  `continue-on-error`, not with `.skip`, not with `@ts-ignore`. A failing gate means the code is
  wrong.

---

## Pull request requirements

Every PR body must use the self-report template in `docs/ROADMAP.md` Part A.3. A PR without it is
rejected unread. It requires you to paste literal terminal output, list every changed file against
the task's allowlist, and disclose any rule you were tempted to break.

Several tasks additionally require a **red-then-green proof**: deliberately break the thing the
gate protects, paste the failure output, then revert. A gate you have not watched fail is a gate
you have not tested.

---

## Quick orientation

| Thing | Where |
| --- | --- |
| What to do next | `docs/ROADMAP.md` — current phase, next task |
| Frozen owner decisions | `docs/PROJECT_STATE.md` |
| Gravity Courier run contract | `docs/PRODUCTION_GAMEPLAY_BATCH_1.md` |
| Why a visual decision was made | `docs/VISUAL_REVIEW.md` |
| Game integration contract | `docs/GAME_SDK.md` |
| How to add a new game | `docs/CONTRIBUTING.md` |
| How to upgrade a dependency | `docs/UPGRADING.md` *(after Roadmap Task 5.3)* |
| Deploy and rollback | `docs/DEPLOYMENT.md` |
