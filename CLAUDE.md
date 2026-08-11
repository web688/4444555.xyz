# Working agreement — 4444555.xyz

## Read first, every session

1. `docs/ROADMAP.md` — the execution contract. Current phase, task allowlists, machine-checkable
   gates, and the thirteen non-negotiable rules in Part A.
2. `AGENTS.md` — repository rules.
3. `docs/PROJECT_STATE.md` — durable handoff and frozen owner decisions.

Repository history is authoritative when newer than any document.

## How Alex wants to be worked with

**Deliver everything, every time.** Never end a response with a withheld item — no "one more
thing", no "I left out X", no "want me to also…?" for something that was obviously part of the
job. If it follows logically from the request, do it and report it as done. Asking permission for
the self-evident wastes a round trip and reads as hedging.

The only legitimate reasons to stop and ask are the ones in Roadmap rules 3 and 6: needing a file
outside a task's allowlist, or a gate that has failed twice. Those are escalations, not
hesitation.

**Be concise and direct.** Short explanations. Cut words that carry no information.

**Ask before writing code.** Planning, reading, research, and documentation need no permission.
Changing application code does.

**Answer the question that was asked, honestly, before anything else.** If a plan has a gap, say
"no, that's missing" plainly rather than reframing the gap as a feature.

## Standing constraints

- Do not change the portal's visual design. It is accepted owner work, protected by visual
  baselines from Roadmap Task 2.5.
- Do not reopen the frozen visual and gameplay decisions in `docs/PROJECT_STATE.md` — the
  procedural backdrop, direct controls, matte-white hazards, restrained particles — without a
  specific new playtest finding or an explicit owner request.
- Every game ships tested on desktop **and** mobile. Six Playwright device projects, no
  exceptions. Mobile regressions must be caught by CI, not by Alex on his phone.
- Never print, echo, or commit the contents of `GIT_Token.txt` or `all connection info.txt`.
