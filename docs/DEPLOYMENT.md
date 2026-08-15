# Deployment

Pull requests run verification. Merges to `main` build `apps/portal/dist` and deploy the artifact to GitHub Pages. `CNAME` and `.nojekyll` are copied from `public`.

Production is immutable per commit. A rollback is a revert of the offending commit followed by the normal workflow; the previous Pages artifact remains identifiable by commit SHA. Backend releases later use separate environments and backward-compatible SDK/API changes.

## Live path as of 2026-08-15

GitHub Pages is currently configured with `build_type: legacy` and source `main:/` (repository root). The production mechanism is therefore the branch-root Pages path, not the artifact uploaded by `.github/workflows/pages.yml`.

The root `index.html` on current `main` references `/assets/arcade-loader.js?v=0.15.0` and `/assets/arcade.css?v=0.15.0`, so the branch-root fallback bundle is the content selected by the configured Pages source. The separate `Deploy Pages` workflow also exists and its latest run for `de264e4b814df1b97d9fdd0cd5f160d6f7748946` completed successfully on 2026-08-15, but while Pages remains configured for the legacy `main:/` source that Actions artifact is not the authoritative production path.

Task 1.2 must switch the repository Pages source to GitHub Actions before the legacy root fallback can be retired. Until that switch is confirmed, `index.html`, `assets/arcade-loader.js`, and the split fallback assets remain production-critical.
