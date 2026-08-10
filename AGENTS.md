# Repository rules

- Never claim the visual target has been achieved without a captured, device-tested vertical slice and written review.
- Games communicate through `@4444555/game-sdk`; they must not import Firebase or write leaderboards directly.
- Keep the portal usable without authentication and progressively load games and heavy assets.
- Preserve keyboard, touch, gamepad, reduced-motion, and muted-audio paths.
- A game manifest and validation tests are required for every new title.
