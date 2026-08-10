# Deployment

Pull requests run verification. Merges to `main` build `apps/portal/dist` and deploy the artifact to GitHub Pages. `CNAME` and `.nojekyll` are copied from `public`.

Production is immutable per commit. A rollback is a revert of the offending commit followed by the normal workflow; the previous Pages artifact remains identifiable by commit SHA. Backend releases later use separate environments and backward-compatible SDK/API changes.
