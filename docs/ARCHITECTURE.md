# Architecture decision 0001

## Initial release

- **Portal:** React, TypeScript, Vite on GitHub Pages and the existing custom domain.
- **2D games:** Phaser for gameplay-heavy titles; PixiJS where a custom renderer is more valuable than framework features.
- **3D games:** Babylon.js, beginning with a measured vertical slice. Three.js remains valid for highly custom scene work.
- **Backend phase:** Firebase Authentication, Firestore, Cloud Functions, App Check, Cloud Storage, and optional Analytics/Crashlytics where browser support fits.

GitHub Pages is sufficient for the portal and anonymous games. Accounts, trusted score decisions, private saves, global rankings, and cross-device statistics require separately configured backend services. Google AI Pro is a consumer subscription and is not treated as Firebase or Google Cloud credit.

## Trust boundary

Games never hold privileged credentials or write leaderboard records. The portal gives each run a signed, expiring ticket. The game returns a score claim plus compact replay evidence. A server function validates rate, ticket, ruleset, plausible duration, score invariants, and—where viable—deterministically replays the run before a transaction updates leaderboard aggregates.

Browser anti-cheat is deterrence, not proof: the client is controlled by the player. Competitive events may require stronger server simulation or exclude unverifiable versions.
