# 4444555 Arcade — Platform Hardening Roadmap

Created: 2026-08-11
Owner: Alex (`web688`)
Scope of this document: **platform hardening, then two new games.** No Gravity Courier gameplay
redesign. No backend/accounts phase.

Four questions this document must answer, and does:

| Question | Answer | Where |
| --- | --- | --- |
| Is the existing website style kept? | **Yes — and now protected.** No task changes the portal design, and Task 2.5 adds a visual-regression baseline so an accidental style change fails CI. | Task 2.5, rule 12 |
| Are the two new games developed? | **Yes — Phase 6.** Echo Vector and Prism Siege, built on the hardened platform. | Phase 6 |
| Is every game tested on desktop *and* mobile? | **Yes.** A shared per-game suite runs on a 6-device matrix; a game cannot be marked playable until it passes on all of them. | Task 2.3, Task 2.6 |
| Is it easy to upgrade? | **Yes — after Task 5.3.** Automated dependency PRs, a pinned-version policy, and a documented Babylon/React/Vite upgrade procedure with a rollback. | Task 5.3 |

This document is the execution contract for any agent (human or AI) continuing work on this
repository. It is deliberately mechanical. Every task ends in a command that returns a pass/fail
exit code. An agent that "did the work" but cannot paste a passing gate output has not done the
work.

---

## PART A — RULES FOR THE IMPLEMENTING AGENT

Read this entire part before touching any file. These rules override your own judgement, your
training defaults, and any instinct to be helpful by doing extra.

### A.1 The eleven non-negotiable rules

1. **One task per branch, one task per pull request.** Never combine two task IDs into one
   branch. Branch name is exactly the task ID, lowercased, e.g. `task/0-2-line-endings`.
2. **Touch only the files in the task's `ALLOWED FILES` list.** That list is an allowlist, not a
   suggestion. Creating a new file not on the list is also a violation.
3. **If you believe you must edit a file outside the allowlist — STOP.** Do not edit it. Post a
   comment stating which file, and why, and wait for the owner. "It was necessary" is not a
   defence; asking is free.
4. **Never edit a gate command, a test, or a CI config to make a failing check pass.** If the gate
   fails, the code is wrong, not the gate. The one exception is a task whose explicit purpose is
   to change tests (Task 2.x) — and even then only the tests named in `ALLOWED FILES`.
5. **A task is not complete until you paste the literal, unedited terminal output of its gate
   command**, including the exit code. Paraphrasing, summarising, or asserting "all tests pass"
   without output is treated as a failed task.
6. **If a gate fails twice in a row, STOP and report.** Do not attempt a third fix. Do not disable
   the check. Do not add `--force`, `|| true`, `continue-on-error`, `skip`, `only`, `.skip`,
   `xit`, or `@ts-ignore` anywhere.
7. **Never rewrite git history on `main`.** No `push --force`, no `rebase` of pushed commits, no
   `reset --hard` on a shared branch, no amending a pushed commit.
8. **Never add a runtime dependency that the task does not explicitly name.** Dev dependencies
   likewise. If you think one is needed, STOP and ask (rule 3).
9. **Do not edit the "Accepted and frozen visual/gameplay decisions" section of
   `docs/PROJECT_STATE.md`.** Those are settled owner decisions. You may append to other sections.
10. **Do not change Gravity Courier's look, feel, controls, route logic, difficulty, scoring, or
    audio** in any task in this roadmap. Every task here is behaviour-preserving for the player.
    If a refactor changes what the player sees or feels, you have made a mistake — revert it.
11. **Do not delete or "clean up" anything not named in the task.** Especially: do not delete
    tests, docs, workflows, or manifest fields for tidiness.
12. **Do not change the portal's visual design.** `apps/portal/src/styles.css`, the hero, the
    orbit stage, the card layout, the type scale, the colour palette, and the copy are accepted
    owner work. They appear in no allowlist in Phases 0–5. If a refactor shifts a pixel, you have
    made a mistake. Phase 6 adds new *cards* to the existing grid — it does not restyle the grid.
13. **Deliver the whole task in one pass.** Do not finish a report with a withheld step, an
    "optionally I could also…", or a question about something the task already told you to do. If
    it is in the task, it is your job. Ask only when rule 3 or rule 6 applies.

### A.2 Required per-task procedure

Execute in this exact order. Do not reorder, do not skip, do not batch.

```
 1. git checkout main && git pull
 2. git checkout -b task/<task-id>
 3. Read the task's PRECONDITION and run its precondition command. If it fails, STOP.
 4. Make the change, editing only files in ALLOWED FILES.
 5. Run: npm run verify
 6. Run the task's GATE command.
 7. If either step 5 or 6 fails: fix once, re-run. If it fails again, STOP and report.
 8. git add -A && git commit
 9. git push -u origin task/<task-id>
10. Open a pull request. Its body MUST be the self-report template in A.3, filled in.
11. Wait for CI to go green. Do not merge a red PR. Do not merge your own PR without owner
    approval unless the task says AUTO-MERGE OK.
12. STOP. Do not begin the next task. Report completion and wait.
```

### A.3 Mandatory pull-request self-report template

Copy this verbatim into every PR body and fill it in. A PR without it is rejected unread.

```markdown
## Task
ID: <task id>
Goal (restate in your own words, one sentence): <...>

## Files changed
<paste output of: git diff --name-only main...HEAD>

## Allowlist compliance
Every file above appears in the task's ALLOWED FILES list: YES / NO
If NO, explain — and expect rejection: <...>

## Gate output
Command: <exact command>
```
<paste the literal terminal output, including the final exit code>
```

## npm run verify output
```
<paste the last 20 lines, including the final exit code>
```

## Behaviour change
Did anything the player sees, hears, or feels change? YES / NO
If YES, this task is wrong. Explain: <...>

## Rules I was tempted to break
<Be honest. List any point where you considered editing a test, a gate, a CI file, or a file
outside the allowlist — and what you did instead. Write "none" only if it is true.>

## Out-of-scope issues noticed (reported, NOT fixed)
<...>
```

### A.4 Definition of "done"

A task is done when, and only when, **all** of these are true:

- [ ] The gate command exits 0, and its output is pasted in the PR.
- [ ] `npm run verify` exits 0, and its output is pasted in the PR.
- [ ] `git diff --name-only main...HEAD` contains only files from `ALLOWED FILES`.
- [ ] CI is green on the PR.
- [ ] The self-report template is filled in with no `NO` in the allowlist row.
- [ ] The owner has said the word "merge" (unless the task is marked AUTO-MERGE OK).

### A.5 Escalation phrases

If any of these become true, stop all work and say so plainly:

- "The gate for `<id>` has failed twice. Here is the output. I need direction."
- "Task `<id>` requires editing `<file>`, which is not in its allowlist. Requesting permission."
- "Completing `<id>` as written would change player-visible behaviour. Requesting direction."
- "I cannot verify `<claim>` without a live deploy / a device / owner input."

Never substitute an assumption for an escalation.

---

## PART B — CURRENT STATE (as of 2026-08-11)

Established by direct inspection of the repository at commit `c8e0085`.

### B.1 What exists and works

| Piece | State |
| --- | --- |
| Portal | React 19.2, TypeScript 5.9.3, Vite 7.1.12, ~125-line `App.tsx`, static, no auth |
| Gravity Courier | Babylon.js 9.20.0, manifest `0.15.0`, status `prototype`, playable 120s run |
| `scene.ts` | 946 lines — render setup, backdrop, hazards, route, input, HUD, perf tiering, all in one file |
| Catalog | 3 entries; only `gravity-courier` has `playable: true` |
| Manifest schema | `catalog/schema/game-manifest.schema.json` with one conforming manifest |
| CI | `.github/workflows/ci.yml` runs `npm run verify` on PR and push to main |
| Docs | 13 files in `docs/`, generally accurate about intent |

### B.2 Confirmed defects — these are what this roadmap fixes

**D1 — The SDK is dead code.**
`packages/game-sdk/src/index.ts` defines `GameHost`, `ArcadeGame`, `RunTicket`, `ScoreClaim` and
84 lines of contract. `grep -r "game-sdk" apps/` returns **zero results**. Gravity Courier
implements its own `GateRuntime` type and writes `window.localStorage` directly from
`progress.ts`. `AGENTS.md` states "Games communicate through `@4444555/game-sdk`" — this is
currently false. `tests/contracts.test.mjs` only greps the SDK source file for its own method
names, so it passes without any game conforming to anything.

**D2 — Two competing deploy paths, and the live one is hand-built.**
`.github/workflows/pages.yml` builds `apps/portal/dist` and deploys it via the Pages Action.
Separately, the repo root contains an `index.html` that loads `/assets/arcade-loader.js`, which
fetches five files `assets/arcade.part00.b64` … `part04.b64` (3.6 MB total), base64-decodes them,
concatenates them into a Blob, and dynamically imports it. `tests/visual-gate.test.mjs` decodes
that bundle and asserts on its contents, and `PROJECT_STATE.md` instructs releases to use "an
atomic Git tree/commit for releases containing the split Pages fallback assets" — so this hand-
built bundle is treated as the real release artifact. Every code change therefore requires
manually rebuilding, base64-splitting, and committing 3.6 MB of generated text. This is the
single largest tax on the project.

**D3 — The test suite is a change-detector, not a test suite.**
`tests/visual-gate.test.mjs` (106 lines) contains ~50 assertions of the form
`assert.match(scene, /ship\.position\.x \+ horizontal \* 1\.35/)` and
`assert.ok(scene.includes('particles.maxSize = 0.052'))`. These assert that specific source
substrings exist. They cannot catch a bug, and they block any refactor. There are zero tests that
execute a single line of game or portal code.

**D4 — Version `0.15.0` is hardcoded in at least five places.**
`catalog/manifests/gravity-courier.json`, `apps/portal/src/games/gravity-courier/progress.ts`
(`GRAVITY_COURIER_VERSION`), `assets/arcade-loader.js` (`const release`), root `index.html`
(two query strings), and `tests/visual-gate.test.mjs`. Nothing enforces that they agree.

**D5 — Secrets and junk in the working tree.**
`GIT_Token.txt` (40 bytes, looks like a GitHub token), `all connection info.txt` (207 bytes), and
`opus try.zip` (27 MB) sit in the repo root. All three are currently untracked, and `.gitignore`
does not mention them — so any `git add -A` commits them.

**D6 — CRLF churn.**
There is no `.gitattributes`. `git status` on a Windows checkout reports all 47 tracked files as
modified with 4329 insertions and 4329 deletions — pure line-ending noise. This makes every real
diff unreadable and makes "is the tree clean?" unanswerable.

**D7 — `TESTING.md` describes tests that do not exist.**
It claims browser tests for "catalog search, keyboard navigation, reduced motion, game lifecycle,
pause-on-hidden, and teardown", plus visual regression. None exist. No test runner beyond
`node --test` is installed.

**D8 — Performance budgets are documented but unenforced.**
`PERFORMANCE.md` sets a ≤250 KB gzip portal budget and records a measured 64.5 KB entry and
375 KB Gravity Courier chunk. Nothing in CI checks either number.

**D9 — No mobile testing of any kind, automated or scripted.**
This is the defect that cost the most so far. `PROJECT_STATE.md` records that the owner
discovered "severe mobile stutter and distracting light reflections on the connectors of the
tunnel circles" only after a release reached a real phone. Candidate 0.13 was an emergency mobile
render-path rewrite. The 0.14 obstacle-colour fix then shipped, was wrong, and was caught only by
an owner screenshot. There is no emulated device run, no touch-input test, no orientation test,
and no per-game test suite — so every mobile regression is found by Alex, in production, by hand.
`TESTING.md` names a compatibility baseline of "current and previous Chrome, Edge, Firefox and
Safari; current iOS Safari and Android Chrome". Zero of those are exercised.

**D10 — No upgrade path.**
`apps/portal/package.json` pins exact versions with no ranges: `@babylonjs/core` 9.20.0, React
19.2.0, Vite 7.1.12, TypeScript 5.9.3. There is no Dependabot or Renovate config, no
`npm outdated` check, no lockfile-audit step, and no documented procedure for a Babylon major
upgrade — which is the risky one, since `scene.ts` calls `PBRMaterial`, `DynamicTexture`,
`GlowLayer` and the default rendering pipeline directly. Today a security patch or a Babylon
upgrade is an unbounded manual exercise with no way to tell whether it broke rendering.

**D11 — The portal's visual design is unprotected.**
The site style is accepted owner work, but nothing detects a change to it. A refactor, a
dependency bump, or an over-eager agent can alter layout, spacing, or colour and every existing
check stays green.

### B.3 Owner action items (NOT agent tasks)

These are blocked on Alex and cannot be completed by any agent. They are tracked here so they are
not silently dropped.

- **O1 — Confirm candidate 0.15 obstacle colour on desktop.** `PROJECT_STATE.md` states 0.14 was
  rejected (bodies rendered near-black) and 0.15 (PBR `unlit`, white albedo) is awaiting one
  desktop run confirming obstacles read white at long range.
- **O2 — Confirm mobile frame pacing on the same device that showed severe stutter**, and confirm
  tunnel-connector reflections are gone.
- **O3 — Rotate the GitHub token in `GIT_Token.txt`.** Assume it is compromised. An agent must
  never do this.
- **O4 — Report the GitHub Pages source setting** (Settings → Pages → Build and deployment):
  "GitHub Actions" or "Deploy from a branch". Task 1.1 is blocked until this is known.

---

## PART C — THE PLAN

Six phases, sequential. **Do not start a phase until the previous phase's exit criteria are met
and the owner has confirmed.**

```
Phase 0  Hygiene and a readable baseline           ~1 session    unblocks everything
Phase 1  One deployment path                       ~1-2 sessions removes the manual-bundle tax
Phase 2  Tests that can fail — desktop AND mobile  ~3 sessions   makes refactoring safe; ends mobile blindness
Phase 3  Make the SDK real                         ~2 sessions   makes game #2 cheap
Phase 4  Decompose scene.ts                        ~2 sessions   makes the game maintainable
Phase 5  Budgets, upgradability, enforcement       ~2 sessions   stops regression and dependency rot
Phase 6  Echo Vector and Prism Siege               ~4+ sessions  the payoff: two new games
```

Phase 2 must precede Phases 3 and 4. Refactoring without executable tests is how this codebase
gets broken. Phase 6 must not start before Phase 3 — building a second game against a fictional
SDK is how the fiction becomes permanent.

---

## PHASE 0 — Hygiene and a readable baseline

**Why first:** right now `git status` shows 47 modified files that contain no changes, and a
token file sits one `git add -A` away from being published. Nothing else can be verified until
the working tree tells the truth.

---

### Task 0.1 — Quarantine secrets and large binaries

**PRECONDITION**
```bash
git status --porcelain | grep -E "GIT_Token|all connection info|opus try"
```
Expect: three lines, each starting with `??` (untracked). If any line starts with `A`, `M`, or the
files appear in `git ls-files`, **STOP** — a secret is in git history and the owner must be told
before anything else happens.

**ALLOWED FILES**
- `.gitignore`

**FORBIDDEN**
- Do not `git rm` anything. Do not delete the files from disk. Do not open, read aloud, echo,
  print, or copy the contents of `GIT_Token.txt` or `all connection info.txt` into any output,
  commit message, PR body, or chat message.

**STEPS**
1. Append to `.gitignore`:
   ```
   # Local operator files — never commit
   GIT_Token.txt
   all connection info.txt
   *.zip
   ```
2. Nothing else.

**GATE**
```bash
git check-ignore -v "GIT_Token.txt" "all connection info.txt" "opus try.zip" && \
test -z "$(git ls-files | grep -Ei 'token|connection info|\.zip$')" && \
echo "GATE 0.1 PASS"
```
Expect three `.gitignore:` lines followed by `GATE 0.1 PASS`, exit 0.

**AUTO-MERGE OK.**

**Owner follow-up:** O3 — rotate the token. Do this even though the file was never committed.

---

### Task 0.2 — Kill the CRLF churn

**PRECONDITION**
```bash
git diff --shortstat
```
Record the number. Expect roughly `47 files changed, 4329 insertions(+), 4329 deletions(-)`.

**ALLOWED FILES**
- `.gitattributes` (new)
- Any tracked text file, **but only as the result of `git add --renormalize .`** — you may not
  hand-edit a single line of content.

**STEPS**
1. Create `.gitattributes`:
   ```
   * text=auto eol=lf
   *.png binary
   *.jpg binary
   *.zip binary
   *.b64 -text
   ```
2. Run `git add --renormalize .`
3. Commit.

**GATE**
```bash
git add --renormalize . && \
git diff --cached --shortstat | grep -q . || echo "already normalized"; \
git commit -m "Normalize line endings" 2>/dev/null; \
git status --porcelain --untracked-files=no | tee /tmp/g02.txt; \
test ! -s /tmp/g02.txt && npm run verify && echo "GATE 0.2 PASS"
```
Expect: empty `git status`, `npm run verify` exit 0, `GATE 0.2 PASS`.

**Verification that it actually worked:** on a fresh clone,
`git clone <repo> /tmp/fresh && cd /tmp/fresh && git status --porcelain` must print nothing.

---

### Task 0.3 — Record a green baseline

**PRECONDITION** — Tasks 0.1 and 0.2 merged.

**ALLOWED FILES**
- `docs/BASELINE.md` (new)

**STEPS**
1. Run, from a clean clone, and capture every byte of output:
   ```bash
   node --version
   npm --version
   npm ci
   npm run typecheck
   npm test
   npm run build
   du -sh apps/portal/dist
   ```
2. Write `docs/BASELINE.md` containing: date, commit SHA, Node/npm versions, and the literal
   output of each command. Do not summarise. Do not omit warnings.

**GATE**
```bash
npm ci && npm run verify && test -f docs/BASELINE.md && \
grep -q "$(git rev-parse HEAD | cut -c1-7)" docs/BASELINE.md && echo "GATE 0.3 PASS"
```

**AUTO-MERGE OK.**

---

### Phase 0 exit criteria

- [ ] `git status --porcelain` on a fresh clone prints nothing.
- [ ] `git ls-files` contains no token, credential, or `.zip` file.
- [ ] `docs/BASELINE.md` exists and records a green `npm run verify`.
- [ ] Owner has rotated the token (O3).

---

## PHASE 1 — One deployment path

**Why:** D2. Today a release means hand-building a bundle, base64-splitting it into five files,
and committing 3.6 MB of generated text — and a test asserts on the *decoded contents* of that
blob. Until this is gone, every single change in Phases 2–5 costs an extra manual bundle rebuild,
and an agent that forgets one ships a site that silently runs old code.

**BLOCKED ON O4.** Do not start Task 1.1 until the owner reports the Pages source setting.

---

### Task 1.1 — Determine and document the live path

**ALLOWED FILES**
- `docs/DEPLOYMENT.md`

**STEPS**
1. Ask the owner for O4 (Pages source setting) if not already supplied.
2. Fetch `https://4444555.xyz/` and record whether the served HTML references
   `/assets/arcade-loader.js` (branch-root path is live) or a Vite-hashed
   `/assets/index-<hash>.js` (Actions path is live).
3. Check the Actions tab: has `Deploy Pages` ever completed successfully? Record the most recent
   run's conclusion and date.
4. Write the finding into `docs/DEPLOYMENT.md` under a new `## Live path as of <date>` heading.
   State plainly which mechanism serves production and which is vestigial.

**GATE**
```bash
grep -q "## Live path as of" docs/DEPLOYMENT.md && \
grep -qE "arcade-loader|index-[a-z0-9]{8}" docs/DEPLOYMENT.md && echo "GATE 1.1 PASS"
```

**Do not change any deployment behaviour in this task.** Documentation only.

---

### Task 1.2 — Make the Actions build the live path

**PRECONDITION** — Task 1.1 merged; owner has confirmed which path is live.

**ALLOWED FILES**
- `.github/workflows/pages.yml`
- `apps/portal/public/CNAME`
- `apps/portal/public/.nojekyll`
- `docs/DEPLOYMENT.md`

**FORBIDDEN**
- Do not delete `index.html`, `assets/arcade-loader.js`, or any `assets/*.b64` in this task. That
  is Task 1.3, and only after 1.2 is confirmed live. **Deleting the fallback before the
  replacement is proven live takes the site down.**

**STEPS**
1. Confirm `apps/portal/public/CNAME` contains `4444555.xyz` and `apps/portal/public/.nojekyll`
   exists, so the built artifact carries both.
2. If Pages source is "Deploy from a branch", the owner must switch it to "GitHub Actions". You
   cannot do this; escalate.
3. Add a build-output assertion step to `pages.yml`, before upload:
   ```yaml
   - name: Assert artifact is complete
     run: |
       test -f apps/portal/dist/index.html
       test -f apps/portal/dist/CNAME
       test -f apps/portal/dist/.nojekyll
       grep -q 'crossorigin src="/assets/index-' apps/portal/dist/index.html
   ```
4. Merge and let it deploy.

**GATE** — run *after* the Pages deployment completes:
```bash
curl -sS https://4444555.xyz/ | tee /tmp/live.html | grep -qE 'src="/assets/index-[A-Za-z0-9_-]+\.js"' && \
! grep -q 'arcade-loader' /tmp/live.html && \
curl -sS -o /dev/null -w "%{http_code}\n" https://4444555.xyz/ | grep -q 200 && \
echo "GATE 1.2 PASS"
```

**Manual gate (also required):** load `https://4444555.xyz/` in a browser, launch Gravity
Courier, complete or fail one run, press Escape. Report: did it load, did the run play, were
there console errors? Paste the console output.

---

### Task 1.3 — Delete the hand-built fallback bundle

**PRECONDITION** — Task 1.2's gate passed **and** the owner has confirmed the live site works.
Do not proceed on your own judgement.

**ALLOWED FILES**
- `index.html` (delete)
- `assets/arcade-loader.js` (delete)
- `assets/arcade.part00.b64` … `assets/arcade.part04.b64` (delete)
- `assets/arcade.css` (delete)
- `.nojekyll` at repo root (keep — do not delete)
- `tests/visual-gate.test.mjs` (delete **only** the test named
  `"Pages fallback contains true unlit obstacle correction 0.15"`, nothing else)
- `docs/DEPLOYMENT.md`, `docs/PROJECT_STATE.md`

**STEPS**
1. Delete the six fallback files.
2. Remove only the one named test from `tests/visual-gate.test.mjs`. Leave every other assertion
   in place — they are replaced in Phase 2, not here.
3. In `docs/PROJECT_STATE.md`, remove the line about "atomic Git tree/commit for releases
   containing the split Pages fallback assets" and replace it with a statement that releases are
   produced by the Pages Action from `apps/portal/dist`.
4. Update `docs/DEPLOYMENT.md` accordingly.

**GATE**
```bash
test -z "$(git ls-files | grep -E 'arcade\.part|arcade-loader')" && \
test ! -f index.html && \
npm run verify && \
curl -sS -o /dev/null -w "%{http_code}\n" https://4444555.xyz/ | grep -q 200 && \
echo "GATE 1.3 PASS"
```

**Rollback:** `git revert` the merge commit; the Pages Action redeploys the previous artifact.

---

### Task 1.4 — Single-source the version number

**Why:** D4. `0.15.0` appears in the manifest, `progress.ts`, and (until 1.3) two more places.

**ALLOWED FILES**
- `catalog/manifests/gravity-courier.json`
- `apps/portal/src/games/gravity-courier/progress.ts`
- `apps/portal/src/games/gravity-courier/version.ts` (new, optional)
- `tests/manifest.test.mjs`
- `scripts/check-versions.mjs` (new)
- `package.json` (the `verify` script line only)

**STEPS**
1. Make the manifest JSON the single source. Import it into `progress.ts` via
   `import manifest from "../../../../../catalog/manifests/gravity-courier.json"` (Vite resolves
   JSON natively) or, if the path is awkward, create `version.ts` that re-exports it — but the
   literal string must appear in exactly one file.
2. Write `scripts/check-versions.mjs` that:
   - reads `catalog/manifests/gravity-courier.json`
   - asserts `engine.version` equals `apps/portal/package.json` `dependencies["@babylonjs/core"]`
   - asserts the string `manifest.version` appears in **no** `.ts`/`.tsx` source file as a literal
   - exits 1 with a clear message on any mismatch
3. Add `"check:versions": "node scripts/check-versions.mjs"` to root `package.json` and chain it
   into `verify`.

**GATE**
```bash
npm run check:versions && \
test "$(grep -roE '"0\.15\.0"' apps/portal/src | wc -l)" -eq 0 && \
npm run verify && echo "GATE 1.4 PASS"
```

**Red-then-green proof (required in the PR):** temporarily change `engine.version` in the
manifest to `9.0.0`, run `npm run check:versions`, paste the failure output, then revert. A gate
you have not seen fail is a gate you have not tested.

---

### Phase 1 exit criteria

- [ ] `https://4444555.xyz/` is served from `apps/portal/dist` via the Pages Action.
- [ ] No `.b64`, `arcade-loader.js`, or root `index.html` in `git ls-files`.
- [ ] Repo size dropped by ~3.6 MB per historical release.
- [ ] `npm run verify` includes a version-consistency check that has been observed failing.
- [ ] A code change can go from commit to live with **zero** manual build steps.

---

## PHASE 2 — Tests that can actually fail

**Why:** D3 and D7. There is currently no test that executes any application code. Phases 3 and 4
are refactors; performing them against a suite of source-regex assertions means the tests will go
red for every correct change and stay green for every real bug.

---

### Task 2.1 — Install a real test runner

**ALLOWED FILES**
- `package.json`, `package-lock.json`
- `vitest.config.ts` (new)
- `apps/portal/tsconfig.json` (types field only)

**Dependencies explicitly authorised (and no others):** `vitest`, `@vitest/coverage-v8`,
`jsdom`, `@testing-library/react`, `@testing-library/user-event`.

**STEPS**
1. Install the above as devDependencies at the root.
2. Create `vitest.config.ts` with `environment: "jsdom"`, `include: ["tests/unit/**/*.test.ts"]`.
3. Add `"test:unit": "vitest run"` to root scripts. **Keep `npm test` (node:test) working** — the
   existing manifest/contract tests stay until Task 2.4 replaces them. Chain both into `verify`.
4. Add one trivial passing test at `tests/unit/smoke.test.ts` to prove the harness runs.

**GATE**
```bash
npm run test:unit && npm run verify && echo "GATE 2.1 PASS"
```

---

### Task 2.2 — Extract pure logic out of `scene.ts` and test it

**Why:** `scene.ts` is 946 lines with route generation, scoring, the sector schedule, the
near-miss chain, and the input mapping all entangled with Babylon.js objects. None of it is
reachable by a test. All of it is pure arithmetic.

**ALLOWED FILES**
- `apps/portal/src/games/gravity-courier/rules.ts` (new)
- `apps/portal/src/games/gravity-courier/scene.ts` (**deletions and imports only** — move code
  out, import it back; do not change any number, formula, or constant)
- `tests/unit/rules.test.ts` (new)
- `tests/visual-gate.test.mjs` (only to delete assertions that reference lines you moved)

**FORBIDDEN**
- Changing any numeric constant. `1.35`, `Math.exp(-delta * 20)`, `0.052`, `12`, `650`, `18_000`,
  `32_000`, the sector speeds, the particle capacities — every one must be byte-identical after
  the move. This is a cut-and-paste refactor, not a tuning pass.

**STEPS**
1. Move into `rules.ts`, unchanged:
   - the sector schedule (which sector at time `t`, cruise speed, obstacle rotation, spacing)
   - score accumulation and the collision penalty
   - the near-miss chain multiplier (`Math.min(12, multiplier + 1)`)
   - the hull/failure predicate
   - the steering-input mapping (`steerX` clamp, the exponential decay, reversal handling)
   - route generation given a seed
2. Import them back into `scene.ts`. `scene.ts` gets shorter; nothing else changes.
3. Write `tests/unit/rules.test.ts` covering, at minimum:
   - a fixed seed produces an identical route array across two calls (determinism)
   - two different daily keys produce different routes
   - `getDailyRouteKey` is UTC-stable across a local-timezone boundary
   - the multiplier caps at exactly 12 and never exceeds it over 1000 near misses
   - a collision subtracts exactly 650 and resets the chain to 1
   - medal thresholds: 17999→bronze, 18000→silver, 31999→silver, 32000 with hull 2→gold,
     32000 with hull 1→silver, any score with `completed: false`→none
   - sector boundaries land at exactly 30/60/90 seconds
   - releasing input produces zero lateral velocity (no recentring drift) — this is a frozen
     owner decision and must have a test

**GATE**
```bash
npm run test:unit -- --coverage && \
node -e "const c=require('./coverage/coverage-summary.json');const f=Object.keys(c).find(k=>k.includes('rules.ts'));if(!f)throw new Error('rules.ts not covered');const p=c[f].statements.pct;console.log('rules.ts statement coverage:',p);if(p<90)process.exit(1)" && \
npm run verify && echo "GATE 2.2 PASS"
```

**Behaviour-preservation proof (required in the PR):** play one run on `npm run dev` before the
change and one after, on the same UTC date. Report score, sector reached, and whether the route
felt identical. If the route differs, you changed a constant — revert and start over.

---

### Task 2.3 — End-to-end tests on a real device matrix

**Addresses D9.** This is the most important task in Phase 2. Mobile is not an afterthought
here — it is half the matrix, because every expensive bug in this project's history was a mobile
bug found by hand.

**ALLOWED FILES**
- `package.json`, `package-lock.json`
- `playwright.config.ts` (new)
- `tests/e2e/*.spec.ts` (new)
- `.github/workflows/ci.yml`

**Dependencies explicitly authorised:** `@playwright/test`.

**THE DEVICE MATRIX — all six projects are mandatory**

| Project | Engine | Emulation | Why |
| --- | --- | --- | --- |
| `desktop-chrome` | Chromium | 1920×1080 | primary desktop target |
| `desktop-firefox` | Firefox | 1920×1080 | different WebGL stack; catches Babylon issues Chromium hides |
| `desktop-safari` | WebKit | 1440×900 | `TESTING.md` baseline; Safari WebGL differs most |
| `mobile-ios` | WebKit | iPhone 14, `hasTouch`, `isMobile`, landscape | the `pointer: coarse` render tier |
| `mobile-android` | Chromium | Pixel 7, `hasTouch`, `isMobile`, landscape | the other coarse-pointer tier |
| `mobile-portrait` | Chromium | Pixel 7 portrait | manifest declares `orientation: landscape` — portrait must degrade gracefully, not break |

Configure all six as Playwright projects. **Do not reduce the matrix to make CI faster.** If CI
time is a problem, run the full matrix on `main` and a desktop+mobile pair on PRs — but never
delete a project.

**STEPS**
1. Install Playwright with `chromium`, `firefox`, and `webkit` browsers.
2. Write `playwright.config.ts` with the six projects above, `webServer` pointing at
   `npm run dev`, `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`.
3. Write `tests/e2e/portal.spec.ts` — runs on **all six** projects:
   - portal loads, `h1` visible, zero `console.error` entries
   - typing "echo" filters the grid to one card; "zzzz" shows the empty state
   - Echo Vector and Prism Siege launch buttons are `disabled`
   - keyboard tab traversal reaches the Gravity Courier launch button
   - **mobile only:** no horizontal scroll (`document.documentElement.scrollWidth <=
     window.innerWidth`) — the classic mobile layout break
   - **mobile only:** every interactive control has a touch target ≥44×44 CSS px
   - the local flight-record panel renders without a saved run (empty state)
4. Write `tests/e2e/gravity-courier.spec.ts` — runs on **all six** projects:
   - launch mounts a `<canvas>` within 15 s (30 s on mobile projects)
   - canvas is non-blank (screenshot contains >1 distinct pixel colour)
   - the HUD countdown decreases over 5 s
   - `Escape` returns to the portal; canvas removed from DOM
   - after exit `document.querySelectorAll('canvas').length === 0` (teardown per `GAME_SDK.md`)
   - `visibilitychange` → `hidden` pauses the run (HUD phase becomes `paused`); resuming restores
     `running` — required by `GAME_SDK.md` and currently untested
   - `prefers-reduced-motion: reduce` emulated → still mounts and runs
   - mute path: toggling mute does not end or stall the run
   - **mobile only:** a touch drag on the canvas steers the craft (`steerX` telemetry becomes
     non-zero) and **releasing the touch returns lateral velocity to zero** — this is a frozen
     owner decision ("no automatic recentring drift") and has never had a test
   - **mobile only:** the run reports `quality: "balanced"` and the mobile tier is active —
     asserts the `pointer: coarse` path from candidate 0.13 actually engages
   - **desktop only:** WASD and arrow keys both steer, and a reversal registers within one frame
5. Add an `e2e` job to `ci.yml` running after `verify`, uploading traces and screenshots as
   artifacts on failure.

**GATE**
```bash
npx playwright test --reporter=line && \
test "$(node -e "console.log(require('./playwright.config.ts.json'||'{}')?0:0)" 2>/dev/null; grep -c "name:" playwright.config.ts)" -ge 6 && \
echo "GATE 2.3 PASS"
```
Simpler equivalent if the above is awkward in your shell:
```bash
npx playwright test --reporter=line && \
npx playwright test --list | grep -Eo '\[(desktop|mobile)-[a-z]+\]' | sort -u | wc -l | grep -q 6 && \
echo "GATE 2.3 PASS"
```
The gate fails if fewer than six projects ran. That is deliberate — it is the mechanism that
stops an agent from quietly dropping mobile to get green.

**Red-then-green proof (required):** comment out the `destroy()` call in
`GravityCourierGate.tsx` cleanup, run the teardown test, paste the failure, restore. Then do it
again for mobile: force `mobileTier` to `false` and confirm the mobile-tier assertion fails.
Two proofs, both pasted.

---

### Task 2.5 — Lock the portal's visual design

**Addresses D11 and answers "is the website style kept?" with a check instead of a promise.**

**ALLOWED FILES**
- `tests/e2e/visual.spec.ts` (new)
- `tests/e2e/visual.spec.ts-snapshots/` (new — generated baselines)
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `docs/TESTING.md`

**FORBIDDEN**
- Editing `apps/portal/src/styles.css` or any markup in `App.tsx`. This task photographs the
  current design; it does not adjust it. If a screenshot looks wrong to you, that is not your
  call — report it and leave it.

**STEPS**
1. Write `tests/e2e/visual.spec.ts` capturing full-page screenshots on `desktop-chrome`,
   `mobile-ios`, and `mobile-portrait`, of: the hero, the catalog grid, the production/gate
   section, the foundation section, and the footer.
2. Freeze the non-deterministic parts before capturing — disable CSS animations, stub the flight
   record to fixed values, and mask the orbit stage if it animates. A flaky visual test gets
   deleted by the next agent, so it must be stable or it is worthless.
3. Set `maxDiffPixelRatio: 0.01`.
4. Commit the generated baselines. **Review them once by eye before committing** and confirm in
   the PR that they show the site as it currently looks.
5. Document in `TESTING.md`: an intentional design change means regenerating baselines with
   `--update-snapshots` in a PR whose title starts `design:`, and it needs owner approval.

**GATE**
```bash
npx playwright test tests/e2e/visual.spec.ts --reporter=line && \
test "$(find tests/e2e/visual.spec.ts-snapshots -name '*.png' | wc -l)" -ge 9 && \
echo "GATE 2.5 PASS"
```

**Red-then-green proof (required):** add `body { background: red }` to `styles.css`, run the
test, paste the failure, revert. This is the proof that the site style is now genuinely protected.

---

### Task 2.6 — Turn the game tests into a reusable per-game suite

**Why:** answering "is every game tested on desktop and mobile?" permanently means the answer
cannot depend on whoever builds game #2 remembering to write tests. Phase 6 inherits this suite.

**ALLOWED FILES**
- `tests/e2e/shared/gameSuite.ts` (new)
- `tests/e2e/gravity-courier.spec.ts` (refactor to call it)
- `docs/TESTING.md`, `docs/CONTRIBUTING.md`

**STEPS**
1. Extract everything in Task 2.3 step 4 that is not Gravity-Courier-specific into
   `runGameSuite({ slug, launchLabel, expectsLandscape, minMountMs })`.
2. `gravity-courier.spec.ts` becomes: call `runGameSuite({ slug: "gravity-courier", ... })`, plus
   its own game-specific assertions.
3. Document in `CONTRIBUTING.md`: **a title cannot be marked `playable: true` in
   `catalog.ts` until `runGameSuite` passes for it on all six device projects.** This is the
   promotion gate for every future game.

**GATE**
```bash
npx playwright test --reporter=line && \
grep -q "runGameSuite" tests/e2e/gravity-courier.spec.ts && \
grep -q "runGameSuite" docs/CONTRIBUTING.md && \
echo "GATE 2.6 PASS"
```

---

### Task 2.7 — Retire the source-regex assertions

**PRECONDITION** — Tasks 2.2, 2.3, 2.5 and 2.6 merged and green. The regex tests may not be
removed until real tests cover the same ground. This task runs **last** in Phase 2.

**ALLOWED FILES**
- `tests/visual-gate.test.mjs` (delete the file)
- `tests/contracts.test.mjs` (rewrite)
- `tests/invariants.test.mjs` (new)
- `docs/TESTING.md`
- `docs/VISUAL_FEASIBILITY_GATE.md`

**STEPS**
1. Before deleting anything, produce a **mapping table** in the PR body: every assertion in
   `visual-gate.test.mjs`, and for each one either (a) the new test that covers it, or (b) the
   reason it is being dropped. Do not delete an assertion without an entry.
2. Keep, in `tests/invariants.test.mjs`, only the assertions that are genuinely structural and
   cannot be expressed as behaviour:
   - Gravity Courier is lazy-imported (bundle-splitting invariant)
   - manifest `engine.version` matches the installed Babylon version
   - manifest `version` matches `apps/portal/package.json`
   - `scene.ts` contains no `import.*firebase` and no `localStorage`
3. Delete `tests/visual-gate.test.mjs`.
4. Rewrite `docs/TESTING.md` to describe the tests that now exist, not the ones that were
   aspirational. Delete claims that are still untrue.

**GATE**
```bash
test ! -f tests/visual-gate.test.mjs && \
test "$(grep -c 'assert.match(scene' tests/*.mjs 2>/dev/null || echo 0)" -eq 0 && \
npm run verify && npx playwright test --reporter=line && echo "GATE 2.7 PASS"
```

---

### Phase 2 exit criteria

- [ ] Zero tests assert on source-code substrings of `scene.ts`.
- [ ] `rules.ts` has ≥90% statement coverage from executable tests.
- [ ] E2E covers launch, play, pause-on-hidden, exit, and teardown.
- [ ] **All six device projects run in CI — three desktop, three mobile.**
- [ ] **Mobile touch steering and the no-recentring-drift rule have executable tests.**
- [ ] **The `pointer: coarse` mobile render tier is asserted, not assumed.**
- [ ] **The portal design has committed visual baselines; a colour change fails CI.**
- [ ] **`runGameSuite` exists, and `CONTRIBUTING.md` makes passing it the promotion gate for
      `playable: true`.**
- [ ] Four gates have been observed failing on a deliberately introduced bug (teardown, mobile
      tier, style, boundary).
- [ ] `docs/TESTING.md` describes only tests that exist.
- [ ] Alex no longer finds mobile regressions by hand.

---

## PHASE 3 — Make the SDK real

**Why:** D1. `AGENTS.md` and four documents assert that games talk to the platform through
`@4444555/game-sdk`. Nothing does. Until a real game conforms to the interface, the interface is
speculative fiction and game #2 will invent its own conventions all over again.

---

### Task 3.1 — Implement the host

**ALLOWED FILES**
- `apps/portal/src/platform/host.ts` (new)
- `apps/portal/src/platform/localStore.ts` (new)
- `apps/portal/package.json` (add `@4444555/game-sdk` workspace dependency)
- `tests/unit/host.test.ts` (new)

**STEPS**
1. Implement `createLocalHost(gameId: string): GameHost` satisfying the existing interface with
   no changes to `packages/game-sdk/src/index.ts`. If the interface genuinely cannot be satisfied,
   STOP and report which method and why — do not quietly widen the type.
2. Local-only semantics, matching the frozen product decisions:
   - `player` → `{ id: "local", displayName: "Pilot", isGuest: true }`
   - `requestRun()` → an unsigned local ticket with `signature: "local-unverified"` and the daily
     seed. **Do not fabricate a signature that looks real.**
   - `submitScore()` → `{ accepted: true }` with **no `rank`**. `PROJECT_STATE.md` forbids
     presenting local progress as a leaderboard. Never return a rank.
   - `loadSave` / `save` → versioned envelope in localStorage, size-checked against the manifest's
     `save.maximumBytes` (65536), failing soft
   - `reportAchievement` → local idempotent progress
   - `emit` → no-op behind a flag, or `console.debug` in dev only
3. Storage must never throw into gameplay. A quota or private-browsing failure logs and continues.

**GATE**
```bash
npm run test:unit && npm run verify && echo "GATE 3.1 PASS"
```
`tests/unit/host.test.ts` must include: save round-trip; oversized save rejected without throwing;
`localStorage.setItem` stubbed to throw → `save()` resolves anyway; `submitScore` result has no
`rank` property.

---

### Task 3.2 — Conform Gravity Courier to `ArcadeGame`

**ALLOWED FILES**
- `apps/portal/src/games/gravity-courier/index.ts` (new — exports `createGame()`)
- `apps/portal/src/games/gravity-courier/GravityCourierGate.tsx`
- `apps/portal/src/games/gravity-courier/progress.ts`
- `apps/portal/src/App.tsx`
- `tests/unit/*.test.ts`, `tests/e2e/*.spec.ts`

**FORBIDDEN**
- Any change to `scene.ts` beyond what is needed to route persistence through the host.
- Any change to medal thresholds, scoring, route generation, or the run contract.
- Leaving any `window.localStorage` call inside `apps/portal/src/games/`.

**STEPS**
1. Add `index.ts` exporting `createGame(): ArcadeGame` that wraps the existing `GateRuntime`
   (`mount`, `start`, `pause`, `resume`, `destroy`, `getState`).
2. Move persistence: `progress.ts` stops calling `localStorage` directly and instead goes through
   `host.save` / `host.loadSave`. The storage key, schema version, `MAX_RECENT_RUNS = 8`, and the
   shape of `CourierProgress` must not change — **existing players' saved progress must survive.**
3. On run end, call `host.submitScore()` with the real stats, and
   `host.reportAchievement()` for `first-delivery` and `near-miss-chain-12` (both already declared
   in the manifest and currently unimplemented).
4. `App.tsx` constructs the host and passes it down.

**GATE**
```bash
test -z "$(grep -rn 'localStorage' apps/portal/src/games/ || true)" && \
test -n "$(grep -rn 'game-sdk' apps/portal/src/ || true)" && \
npm run verify && npx playwright test --reporter=line && echo "GATE 3.2 PASS"
```

**Save-migration proof (required in the PR):** with the *old* build, play one run so progress is
written. Switch to the new build without clearing storage. Confirm the portal flight record still
shows the same best score and run count. Paste both screenshots or both values.

---

### Task 3.3 — A conformance suite every future game must pass

**ALLOWED FILES**
- `packages/game-sdk/src/conformance.ts` (new)
- `packages/game-sdk/src/index.ts` (export the new module only — no interface changes)
- `tests/unit/conformance.test.ts` (new)
- `tests/contracts.test.mjs` (delete — superseded)
- `scripts/check-game-boundary.mjs` (new)
- `package.json`
- `docs/GAME_SDK.md`, `docs/CONTRIBUTING.md`

**STEPS**
1. Write `runConformanceSuite(createGame)` in `conformance.ts` asserting the lifecycle contract
   from `GAME_SDK.md`:
   - `mount → ready → start → running ↔ paused → ended → destroy` in order
   - `start()` with an expired ticket rejects
   - `start()` with a mismatched `gameId` rejects
   - `pause()` then `resume()` returns to `running`
   - `destroy()` is idempotent and leaves `getState() === "destroyed"`
   - calling `start()` after `destroy()` rejects rather than throwing uncaught
2. Run it against Gravity Courier in `tests/unit/conformance.test.ts`.
3. Write `scripts/check-game-boundary.mjs` — a static gate that fails if anything under
   `apps/portal/src/games/` contains `firebase`, `localStorage`, `sessionStorage`, `indexedDB`,
   `document.cookie`, or a bare `fetch(`. This mechanically enforces the `AGENTS.md` rule that
   games must not write leaderboards or hold credentials.
4. Chain `check:boundary` into `verify`.
5. Update `docs/GAME_SDK.md` and `docs/CONTRIBUTING.md`: passing `runConformanceSuite` is a
   requirement for every new title.

**GATE**
```bash
npm run check:boundary && npm run test:unit && npm run verify && echo "GATE 3.3 PASS"
```
**Red-then-green proof (required):** add `window.localStorage.getItem("x")` to a file under
`games/`, run `npm run check:boundary`, paste the failure, revert.

---

### Phase 3 exit criteria

- [ ] `grep -r "game-sdk" apps/` returns real imports.
- [ ] Zero direct storage or network calls under `apps/portal/src/games/`.
- [ ] Gravity Courier passes an executable lifecycle conformance suite.
- [ ] Existing players' local progress survived the migration (proven, not assumed).
- [ ] CI mechanically blocks a game that breaks the boundary.
- [ ] `AGENTS.md`'s SDK claim is now true.

---

## PHASE 4 — Decompose `scene.ts`

**Why:** 946 lines mixing engine setup, procedural texture painting, geometry, materials, input,
audio, HUD telemetry, and performance tiering. Every visual fix in the last 15 commits touched
this one file. It is the reason the 0.13/0.14/0.15 obstacle-colour bug took three attempts.

**PRECONDITION** — Phase 2 complete. Do not refactor without executable tests.

**This entire phase is behaviour-preserving.** If the player can tell the difference, it failed.

---

### Task 4.1 — Split by responsibility

**ALLOWED FILES** — new files under `apps/portal/src/games/gravity-courier/scene/`:
`engine.ts`, `backdrop.ts`, `materials.ts`, `hazards.ts`, `route.ts`, `input.ts`, `hud.ts`,
`quality.ts`, `index.ts`; plus `scene.ts` (shrinks to an orchestrator).

**FORBIDDEN**
- Changing any numeric constant, colour, material property, or ordering of Babylon calls.
- Changing the public `createGravityCourierScene` signature or the `GateRuntime`/`GateTelemetry`
  types.
- Doing this in more than one PR-sized chunk without re-running the full gate each time.

**Suggested split**
| File | Owns |
| --- | --- |
| `engine.ts` | `Engine`, `Scene`, hardware scaling, the mobile/coarse-pointer tier decision |
| `quality.ts` | high/balanced tiering, `lowFpsSeconds` downgrade, frame-time sampling, `buildReport()` |
| `backdrop.ts` | `createDeepSpaceBackdrop`, `paintNebula`, star field, `DynamicTexture` |
| `materials.ts` | `unlitMatte`, `hazard-pbr-unlit-white`, `lane-connector-matte`, orange accents |
| `hazards.ts` | obstacle meshes, pooling, rotation, near-miss detection |
| `route.ts` | rings, relay gate, planet, route particles, sector progression |
| `input.ts` | keyboard, pointer, gamepad, blur/visibility clearing |
| `hud.ts` | telemetry throttling (~8 Hz mobile / 20 Hz desktop), callouts |

**GATE**
```bash
npm run verify && npm run test:unit && npx playwright test --reporter=line && \
test "$(wc -l < apps/portal/src/games/gravity-courier/scene.ts)" -lt 200 && \
echo "GATE 4.1 PASS"
```

**Behaviour-preservation proof (required):** capture a Playwright screenshot of the same frame
(fixed seed, fixed elapsed time, fixed viewport) before and after. Diff them. Report the pixel
difference percentage. Anything above ~0.5% means you changed rendering — investigate before
merging.

---

### Task 4.2 — Document the material and render-path decisions in code

**Why:** the 0.13 → 0.14 → 0.15 obstacle-colour saga cost three release cycles because the
reasoning lived only in `PROJECT_STATE.md`. The next agent editing `materials.ts` will not read
it.

**ALLOWED FILES**
- `apps/portal/src/games/gravity-courier/scene/materials.ts`
- `apps/portal/src/games/gravity-courier/scene/engine.ts`
- `apps/portal/src/games/gravity-courier/scene/quality.ts`

**STEPS** — comments only, zero code change. At minimum record, at the point of use:
- why obstacle bodies use `PBRMaterial.unlit` and **not** `StandardMaterial.disableLighting`
  (the latter drops the diffuse contribution, making bodies render near-black — this was
  candidate 0.14 and it was rejected on owner desktop review)
- why scene fog, bloom, FXAA, grain, and chromatic aberration are disabled (owner rejected
  whole-frame mist and blur; the image must stay sharp)
- why coarse-pointer devices start at CSS-pixel resolution with no glow pass
- why the relay point light is disabled on mobile (flashing connector reflections)
- why route particles are capped at 280/140 with `maxSize = 0.052` (candidate 0.10 "snowstorm")

**GATE**
```bash
git diff main...HEAD -- '*.ts' | grep -E '^\+' | grep -vE '^\+\s*(//|/\*|\*)' | grep -vE '^\+\+\+' | tee /tmp/nc.txt; \
test ! -s /tmp/nc.txt && npm run verify && echo "GATE 4.2 PASS"
```
This gate fails if you added a single non-comment line. That is intentional.

---

### Phase 4 exit criteria

- [ ] No file in the Gravity Courier directory exceeds 300 lines.
- [ ] Screenshot diff before/after is under 0.5%.
- [ ] Every frozen visual decision has a comment at its point of enforcement.
- [ ] All Phase 2 tests still green.

---

## PHASE 5 — Enforce the budgets

**Why:** D8. `PERFORMANCE.md` sets numbers; nothing checks them. Bundle size regresses silently.

---

### Task 5.1 — Bundle budget in CI

**ALLOWED FILES**
- `scripts/check-budget.mjs` (new)
- `package.json`
- `.github/workflows/ci.yml`
- `docs/PERFORMANCE.md`

**STEPS**
1. `check-budget.mjs` builds, then gzips each chunk in `apps/portal/dist/assets` and asserts:
   - portal entry chunk ≤ **250 KB gzip** (currently ~64.5 KB — large headroom, keep it strict)
   - Gravity Courier chunk ≤ **450 KB gzip** (currently ~375 KB)
   - total CSS ≤ **40 KB gzip**
2. Print a table of every chunk with its gzip size, always — not only on failure. The table is
   the record `PERFORMANCE.md` currently keeps by hand.
3. Fail with a message naming the offending chunk and the overage.
4. Update `PERFORMANCE.md` to state the budgets are now CI-enforced and remove the hand-recorded
   numbers that will go stale.

**GATE**
```bash
npm run check:budget && npm run verify && echo "GATE 5.1 PASS"
```
**Red-then-green proof (required):** temporarily lower the portal budget to 10 KB, run, paste the
failure, revert.

---

### Task 5.2 — Capture real frame-pacing evidence

**Why:** `VISUAL_REVIEW.md` records that desktop and mobile performance certification was
**waived**, not achieved — three runs each with no named device and no numbers. `scene.ts`
already computes `p95FrameMs`, `p99FrameMs`, `onePercentLowFps`, and `slowFramePercent` in
`buildReport()`. Nothing captures them.

**ALLOWED FILES**
- `tests/e2e/performance.spec.ts` (new)
- `.github/workflows/ci.yml`
- `docs/PERFORMANCE.md`

**STEPS**
1. Playwright test: launch Gravity Courier headed with a fixed viewport, play a scripted 60 s
   segment, read `buildReport()` out of the page, write it to `perf-report.json`.
2. Upload it as a CI artifact on every run.
3. **Do not fail CI on a frame-rate threshold.** CI runners have no GPU; a threshold here would
   be noise and would train the next agent to disable it. Record only, and trend over time.
4. Document in `PERFORMANCE.md` that CI numbers are indicative and that named-device certification
   (owner items O1/O2) remains the only accepted evidence for the 60 fps desktop / 30 fps mobile
   targets.

**GATE**
```bash
npx playwright test tests/e2e/performance.spec.ts --reporter=line && \
test -f perf-report.json && \
node -e "const r=require('./perf-report.json');for(const k of ['p95FrameMs','p99FrameMs','onePercentLowFps','slowFramePercent'])if(r[k]===undefined)throw new Error('missing '+k);console.log(r)" && \
echo "GATE 5.2 PASS"
```

---

### Task 5.3 — Make upgrades routine instead of frightening

**Addresses D10 and answers "is it easy to upgrade?".** Today every dependency is pinned to an
exact version, nothing reports drift, and a Babylon major bump is an unbounded manual risk
because `scene.ts` calls `PBRMaterial`, `DynamicTexture`, `GlowLayer` and the default rendering
pipeline directly.

**PRECONDITION** — Phase 2 complete. An upgrade you cannot test is not an upgrade, it is a
gamble. Do not attempt this task before the device matrix and visual baselines exist.

**ALLOWED FILES**
- `.github/dependabot.yml` (new)
- `.github/workflows/ci.yml`
- `scripts/check-deps.mjs` (new)
- `package.json`
- `docs/UPGRADING.md` (new)
- `docs/BUILD.md`

**FORBIDDEN**
- Actually upgrading anything in this task. This builds the machinery; upgrades come after, one
  per PR, each through the documented procedure. Do not bundle a Babylon bump into this PR.

**STEPS**
1. `.github/dependabot.yml`: weekly npm updates, grouped into three PRs —
   `dev-dependencies` (patch+minor, auto-mergeable when CI is green),
   `production-minor` (React/Vite/TS minor), and `engine-major` (anything Babylon, or any major)
   which is always reviewed by a human. Never group Babylon with anything else.
2. `scripts/check-deps.mjs`: fails CI if `npm audit --audit-level=high` reports anything, and
   **warns** (does not fail) if any direct dependency is more than two minor versions behind.
   Print a table so drift is visible on every run rather than discovered during an incident.
3. Write `docs/UPGRADING.md` with a concrete, ordered procedure:
   - **Any upgrade:** branch → bump one package → `npm run verify` → full six-project Playwright
     run → visual baselines must not move → merge.
   - **Babylon minor:** the above, plus a manual desktop and mobile run, plus a check that
     obstacle bodies still render matte white at distance (the 0.13/0.14/0.15 bug class).
   - **Babylon major:** the above, plus an explicit review of every Babylon API called from
     `scene/` (list them in the doc — `Engine`, `Scene`, `PBRMaterial`, `StandardMaterial`,
     `DynamicTexture`, `GlowLayer`, `DefaultRenderingPipeline`, `ParticleSystem`, `Scalar`,
     `Color3`, `Color4`), plus owner sign-off. Never auto-merge.
   - **Rollback for all of the above:** revert the merge commit; the Pages Action redeploys the
     previous artifact. State this explicitly so nobody improvises under pressure.
4. Record the current pinning policy: exact pins stay (they make builds reproducible); Dependabot
   is what keeps them current. Both facts belong in `BUILD.md`.

**GATE**
```bash
node scripts/check-deps.mjs && \
test -f .github/dependabot.yml && test -f docs/UPGRADING.md && \
grep -q "engine-major" .github/dependabot.yml && \
grep -q "Rollback" docs/UPGRADING.md && \
git diff main...HEAD -- package.json apps/portal/package.json | grep -E '^\+.*"[0-9]+\.[0-9]+\.[0-9]+"' | grep -v '"scripts"' | tee /tmp/bump.txt; \
test ! -s /tmp/bump.txt && npm run verify && echo "GATE 5.3 PASS"
```
The last clause fails if you bumped a version. Machinery only.

**Red-then-green proof (required):** temporarily set a dependency to a known-vulnerable old
version, run `node scripts/check-deps.mjs`, paste the failure, revert.

---

### Phase 5 exit criteria

- [ ] A PR that grows the portal bundle past budget fails CI.
- [ ] Every CI run publishes a frame-pacing artifact.
- [ ] `PERFORMANCE.md` distinguishes CI-indicative numbers from owner-certified device evidence.
- [ ] Dependabot opens grouped weekly PRs; Babylon is never grouped with anything else.
- [ ] `npm audit` at high severity fails CI.
- [ ] `docs/UPGRADING.md` gives a step-by-step procedure and a rollback for minor, major, and
      Babylon upgrades.
- [ ] A dependency upgrade is now: merge a Dependabot PR, watch six device projects and the
      visual baselines go green.

---

## PHASE 6 — Echo Vector and Prism Siege

**PRECONDITION** — Phases 0–5 complete, and the owner has closed items O1 and O2 (Gravity Courier
accepted on desktop and mobile). `PROJECT_STATE.md` rule stands: *do not start a second playable
game until Gravity Courier is a convincing real game.* That rule is satisfied by owner
confirmation, not by an agent's opinion.

**Echo Vector is also the audit of Phases 0–5.** If it can be built without editing
`packages/game-sdk`, without touching the portal's styles, without a new deploy step, and it
passes `runConformanceSuite` and `runGameSuite` unmodified — the hardening worked. If it requires
widening the SDK, the abstraction was wrong, and it is far cheaper to learn that on game #2 than
on game #4. **Build Echo Vector first and stop to review, before starting Prism Siege.**

---

### Task 6.0 — Prove the platform before writing a game

**ALLOWED FILES**
- `apps/portal/src/games/_template/` (new: `index.ts`, `game.ts`, `README.md`)
- `catalog/manifests/_template.json` (new)
- `tests/e2e/template.spec.ts` (new)
- `docs/CONTRIBUTING.md`

**STEPS**
1. Build a deliberately trivial game — a coloured square that moves with input and ends after
   10 seconds — implementing `createGame(): ArcadeGame` and nothing else.
2. Wire it through the real host: ticket, score claim, save, one achievement.
3. Run `runConformanceSuite` and `runGameSuite` against it, unmodified.
4. Record in `CONTRIBUTING.md` exactly what a new game must provide: manifest, `createGame()`,
   catalog entry, suite pass on six devices, budget compliance.
5. **Report every place the platform fought you.** That list is the real deliverable of this task.

**GATE**
```bash
npx playwright test --reporter=line && npm run verify && \
test -z "$(git diff --name-only main...HEAD -- packages/game-sdk/src/index.ts)" && \
test -z "$(git diff --name-only main...HEAD -- apps/portal/src/styles.css)" && \
echo "GATE 6.0 PASS"
```
The gate fails if you had to change the SDK interface or the portal styles. If it fails, **do not
force it** — report it, because it means Phase 3 is incomplete and a fix there is worth more than
a workaround here.

---

### Task 6.1 — Echo Vector

Existing concept, from `catalog.ts`: *"Your previous runs return as temporal echoes — sometimes
allies, sometimes moving hazards you authored yourself."* Rhythm tactics, 2D, ~3 min.

**Engine:** Phaser or PixiJS per `ARCHITECTURE.md`. **Decide and get owner approval before
writing code** — this is a dependency addition and rule 8 applies.

**Order of work, one PR each:**
1. `catalog/manifests/echo-vector.json` + schema validation passing
2. Design note in `docs/games/ECHO_VECTOR.md`: the 30-second loop, scoring model, input modes,
   accessibility plan, asset estimate — the checklist `CONTRIBUTING.md` already demands
3. Pure rules module + unit tests **before** any rendering — echo recording/playback determinism
   is the whole game; if it is not deterministic and tested, the game does not work
4. Playable slice behind `playable: false`
5. `runGameSuite` green on all six devices
6. Owner review on desktop and mobile
7. Flip `playable: true` — **only after step 6**

**Non-negotiable constraints:** no portal style changes (rule 12); no SDK changes without
escalation; must fit the bundle budget as its own lazy chunk; must not regress the portal entry
chunk; keyboard, touch, gamepad, reduced-motion, and mute paths all required.

**GATE (final, before `playable: true`)**
```bash
npm run verify && npm run check:budget && npm run check:boundary && \
npx playwright test --reporter=line && \
npx playwright test tests/e2e/visual.spec.ts --reporter=line && \
echo "GATE 6.1 PASS"
```
Visual baselines must be unchanged except for the new catalog card.

---

### Task 6.2 — Prism Siege

**PRECONDITION** — Echo Vector is `playable: true` and the owner has reviewed Task 6.0's
"where the platform fought you" report and any resulting SDK fixes have shipped.

Existing concept: *"Rotate a living prism to refract hostile light into chain reactions across a
reactive arena."* Arena puzzler, 2.5D, 4–6 min.

Same seven-step order and the same gate as 6.1. If Prism Siege also needs no platform changes,
the platform is done and the backend phase can be considered.

---

### Phase 6 exit criteria

- [ ] Three playable games, each passing `runGameSuite` on six device projects.
- [ ] `packages/game-sdk/src/index.ts` unchanged since Phase 3, or changed only through an
      escalated, owner-approved decision.
- [ ] `apps/portal/src/styles.css` unchanged since before Phase 0.
- [ ] Portal entry chunk still under 250 KB gzip with three games in the catalog.
- [ ] A documented, repeatable procedure exists for adding game #4.

---

## PART D — AFTER THIS ROADMAP

Do not start any of these without a fresh owner decision.

- **Backend phase.** `ARCHITECTURE.md` describes the trust boundary — signed run tickets, server
  validation, deterministic replay, Firestore aggregates. Nothing implements it. This is the
  largest remaining body of work and it is where "accounts, cross-device sync, and global
  rankings" live.
- **Accessibility audit.** Phase 2 adds keyboard and reduced-motion smoke tests, not an audit.
  No screen-reader pass, no contrast audit, no focus-management review has been done.
- **Error boundary around the lazy game import.** A game crash currently takes the portal with
  it. Cheap to fix, not scheduled here.
- **Error reporting and analytics.** None exist; failures in production are invisible.
- **Real art assets.** Everything is procedural. `PERFORMANCE.md` anticipates glTF, KTX2/Basis,
  and mesh compression; no asset pipeline exists.

---

## PART E — QUICK REFERENCE

### Gate command index

| Task | Gate |
| --- | --- |
| 0.1 | `git check-ignore -v` on the three files + no secrets in `git ls-files` |
| 0.2 | Fresh clone shows empty `git status --porcelain` |
| 0.3 | `npm run verify` green + `docs/BASELINE.md` records the SHA |
| 1.1 | `docs/DEPLOYMENT.md` names the live path |
| 1.2 | Live HTML references Vite-hashed assets, not `arcade-loader` |
| 1.3 | No `.b64` tracked, site still returns 200 |
| 1.4 | `npm run check:versions`, no version literal in `src/` |
| 2.1 | `npm run test:unit` green |
| 2.2 | `rules.ts` ≥90% statement coverage |
| 2.3 | Playwright green on **all six** device projects; gate fails if fewer ran |
| 2.5 | Visual baselines committed; `background: red` makes it fail |
| 2.6 | `runGameSuite` used by the game spec and named in `CONTRIBUTING.md` |
| 2.7 | `visual-gate.test.mjs` gone, zero `assert.match(scene` remaining |
| 3.1 | Host unit tests green |
| 3.2 | Zero `localStorage` under `games/`, `game-sdk` imported |
| 3.3 | `npm run check:boundary` green |
| 4.1 | `scene.ts` under 200 lines, screenshot diff <0.5% |
| 4.2 | Zero non-comment lines added |
| 5.1 | `npm run check:budget` green |
| 5.2 | `perf-report.json` contains all four percentile fields |
| 5.3 | Dependabot + `check-deps` + `UPGRADING.md`; gate fails if you bumped a version |
| 6.0 | Template game passes both suites **without** touching the SDK or portal styles |
| 6.1 | Echo Vector: verify + budget + boundary + six devices + visual baselines |
| 6.2 | Prism Siege: same gate as 6.1 |

### The `verify` script, by the end

```json
"verify": "npm run check:versions && npm run check:boundary && npm run check:deps && npm run typecheck && npm test && npm run test:unit && npm run build && npm run check:budget"
```
Playwright runs as a separate CI job (it needs browsers and a dev server), not inside `verify`.

### The four standing answers

- **Style kept?** Yes — and Task 2.5 proves it on every commit.
- **New games?** Yes — Phase 6, after the platform can carry them.
- **Tested on desktop and mobile?** Yes — six projects, every game, enforced by the gate.
- **Easy to upgrade?** Yes — Task 5.3 makes it merge-a-PR-and-watch-it-go-green.

### Things that must never become true again

- A test that asserts on a source-code substring
- A release step that a human performs by hand
- A version number written in two places
- A game reaching `localStorage`, `fetch`, or Firebase directly
- A documented capability that does not exist
- A credential in the repository directory
- **A mobile regression discovered by Alex instead of by CI**
- **A game marked `playable: true` that has not passed the six-device suite**
- **A dependency nobody dares upgrade**
- **A report that ends with a withheld item instead of finished work**
