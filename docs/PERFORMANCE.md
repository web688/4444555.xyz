# Performance budgets

The portal target is ≤ 250 KB gzip for first-party JS+CSS, excluding fonts, game code, and media. Game bundles load only after intent. Images use AVIF/WebP with explicit dimensions; audio is streamed or sprite-packed; 3D assets use glTF, KTX2/Basis, mesh compression, LODs, and pooled effects.

Measure LCP, INP and CLS on representative mobile hardware. A game records frame-time percentiles and automatically selects a tested quality tier; user choice always overrides auto-detection.

Gravity Courier candidate 0.2 is isolated behind a dynamic import and uses direct Babylon module imports. Its measured primary production code chunk is approximately 375 KB gzip, while the portal entry remains approximately 64.5 KB gzip. Shader support is emitted as additional small on-demand chunks. These are code-only measurements; device approval and future art-asset budgets remain separate gates.
