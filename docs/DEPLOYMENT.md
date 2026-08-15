# Deployment

Pull requests run verification. Merges to `main` build `apps/portal/dist` and deploy the artifact to GitHub Pages. `CNAME` and `.nojekyll` are copied from `public`.

Production is immutable per commit. A rollback is a revert of the offending commit followed by the normal workflow; the previous Pages artifact remains identifiable by commit SHA. Backend releases later use separate environments and backward-compatible SDK/API changes.

## Live path as of 2026-08-15

GitHub Pages is configured with `build_type: workflow`. Production is therefore served from the artifact produced by `.github/workflows/pages.yml`, which builds `apps/portal/dist` and deploys that directory through the GitHub Pages Actions workflow.

`apps/portal/public/CNAME` contains `4444555.xyz` and `apps/portal/public/.nojekyll` exists, so both files are copied into the Vite output. The deployment workflow asserts that `dist/index.html`, `dist/CNAME`, and `dist/.nojekyll` are present and that `dist/index.html` references the Vite-generated `/assets/index-*.js` entry before the artifact can be uploaded.

The legacy root `index.html`, `assets/arcade-loader.js`, and split `assets/*.b64` fallback remain in the repository during Task 1.2. They are not to be deleted until the Actions-built production path is proven live and the Task 1.2 live/manual gates pass; their removal is Task 1.3.

## Owner preview gate

Player-visible pull requests require the exact PR-head candidate to be playable at `https://4444555.xyz/test/` before owner approval, as defined in `docs/OWNER_PREVIEW_GATE.md`. Production at `/` must continue to represent accepted `main`. The preview deployment mechanism is a separate roadmap concern and must not be improvised inside an unrelated task.
