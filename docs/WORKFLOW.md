# Working workflow

This is the current execution workflow for 4444555.xyz. It supersedes the older per-task approval and PR ceremony in `docs/ROADMAP.md` Part A wherever they conflict. The roadmap remains the technical plan and dependency order.

## Approval unit: the phase

The owner approves a phase direction once. After that, the implementing agent completes the planned work without asking for permission after every task, commit, test, or PR.

A phase can contain multiple roadmap tasks and commits. Use one phase branch/PR when practical. Split work only when technical isolation is useful, not to manufacture approval checkpoints.

## Normal phase flow

1. Sync current `main` and inspect recent repository activity.
2. State the phase goal briefly. If the owner already said `proceed` or otherwise approved that direction, start work immediately.
3. Work on a phase branch. Keep changes inside the agreed phase scope.
4. Run relevant tests and `npm run verify`; fix failures until the phase is healthy. Never weaken checks merely to pass.
5. Internal non-player-visible PRs may be merged after CI is green without asking the owner again.
6. For a player-visible phase, publish the exact candidate SHA to `https://4444555.xyz/test/` while production `/` remains on accepted `main`.
7. Give the owner one concise review request: what changed, the `/test/` URL, and anything specific worth checking.
8. If rejected, keep working on the same phase branch, redeploy `/test/`, and return with the improved candidate. Do not ask permission for each fix.
9. A clear positive verdict (`OK`, `looks good`, `approved`, `go ahead`, `merge`, or equivalent) on the current candidate authorizes the phase merge. No second merge confirmation is required.
10. After merge, verify production and continue to the next already-approved technical step. Ask again only when beginning a materially new phase/direction.

## What still deserves an escalation

Stop and involve the owner only when:

- an owner-only external action is required,
- the phase cannot be completed without materially changing an accepted design decision outside the approved direction,
- there is a real technical blocker that cannot be resolved reliably,
- or the intended outcome itself is ambiguous.

Ordinary implementation choices, adjacent files needed to complete the phase, CI fixes, refactors inside scope, and routine deployment work do not require separate permission.

## Game-development interpretation

For a game phase, the owner should not receive a sequence of approval requests for manifest → design doc → rules → slice → controls → visual polish → tests. Those are implementation batches inside one game phase.

The agent should complete the coherent candidate, deploy it to `/test/`, and then ask for the owner's playtest verdict. The owner's job is to judge the game, not administer the development process.

## Safety rails retained

The simplified workflow does not remove the useful protections:

- no development directly on `main`,
- green CI before merge,
- no weakening tests to hide failures,
- no secrets in Git,
- production stays stable while visible candidates are reviewed at `/test/`,
- mobile/desktop verification remains required before a game is considered production-ready,
- accepted portal and game design decisions are not casually reopened.
