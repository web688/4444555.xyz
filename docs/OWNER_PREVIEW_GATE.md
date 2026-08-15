# Owner Preview Gate

Player-visible changes are not eligible for merge until the owner has reviewed the exact candidate build at:

`https://4444555.xyz/test/`

## What requires a preview

This gate applies to any pull request that changes something a player can see, hear, control, or feel, including:

- gameplay or scoring behaviour
- controls or input response
- visuals, materials, lighting, effects, camera, HUD, or portal UI
- audio
- rendering or performance changes that can alter the play experience
- a new game or a change that promotes a game toward `playable: true`

Pure documentation, tests, CI-only changes, and internal refactors that are proven behaviour-preserving do not require owner preview unless the owner asks for one.

## Required preview contract

1. The preview must be built from the exact pull-request head SHA being proposed for merge.
2. `https://4444555.xyz/` must continue to serve the accepted `main` build while the preview is under review.
3. `https://4444555.xyz/test/` must serve the candidate build. A screenshot, CI artifact, local URL, or description is not a substitute.
4. The PR body or review report must state the preview SHA and the preview URL.
5. After CI is green and the preview is live, the implementing agent asks the owner to test `/test/` and give feedback.
6. If the owner rejects the candidate, update the same task branch, redeploy `/test/` from the new head SHA, and request review again.
7. Do not merge a player-visible PR until the owner has approved the candidate he actually reviewed. The approved preview SHA must still equal the PR head SHA at merge time; if the head changes afterwards, the preview approval is invalid and must be repeated.
8. The word `merge` remains the explicit merge authorization unless a future owner decision changes that rule.

## Deployment design requirement

The deployment hardening work must provide a repeatable PR-preview path that preserves accepted production at `/` and publishes the active candidate under `/test/`. The preview mechanism must not require committing generated build artifacts to `main` and must not make an unapproved candidate the production root.

Only one player-visible candidate is reviewed at `/test/` at a time. This matches the repository rule to develop one game/task at a time and avoids ambiguous owner approval.
