# Deployment preview

`https://4444555.xyz/` is production and always comes from accepted `main`.

`https://4444555.xyz/test/` is the owner-review surface:

- normal production deploys build `main` for both `/` and `/test/`, so the preview URL never disappears;
- when a `phase/*` pull request passes the `Verify` workflow, `Deploy Phase Preview` rebuilds `/` from `main` and `/test/` from the verified phase head SHA;
- `/test/preview.json` records the exact preview SHA and branch;
- candidate assets are built with Vite base `/test/`, so they are isolated from production assets;
- a failed Verify run never deploys a preview.

This gives the owner one stable URL for reviewing player-visible phase candidates without replacing production.
