# Game integration contract 0.1

Every title exports `createGame()` and implements `ArcadeGame`. The portal owns mounting and teardown; the host object is the only route to platform capabilities.

## Lifecycle

`mount → ready → start → running ↔ paused → ended → destroy`

- A game must pause on visibility loss and remain deterministic across pause/resume.
- `destroy` removes listeners, audio graphs, workers, canvases, and GPU resources.
- A run starts only with a matching, unexpired `RunTicket`.

## Data

- Saves are versioned, size-limited, migratable, and never trusted for leaderboard state.
- Score claims use integers and include duration, ruleset, ticket, statistics, and optional replay evidence.
- Achievements are idempotent progress claims; authoritative unlocks happen in the host/backend.
- Telemetry names and properties must be documented and contain no free-form personal data.

Breaking changes increase the SDK major version. Manifests declare the required version and validation rejects unsupported combinations.
