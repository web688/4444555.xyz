# Testing strategy

- TypeScript strict mode and manifest contract tests on every pull request.
- Unit tests for SDK adapters, score rules, save migrations, achievements, and deterministic simulation.
- Browser tests for catalog search, keyboard navigation, reduced motion, game lifecycle, pause-on-hidden, and teardown.
- Recorded gameplay sessions and device-lab checks for feel, clarity, audio, thermal load, and frame pacing.
- Compatibility baseline: current and previous Chrome, Edge, Firefox, and Safari; current iOS Safari and Android Chrome.
- Visual regression at desktop, tablet, and narrow mobile widths after art direction is locked.
