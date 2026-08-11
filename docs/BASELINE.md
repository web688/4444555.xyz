# 4444555 Arcade — Green Baseline

Date: 2026-08-11
Commit SHA: 5231a8daebe08ede5999ed98bbb9c75f813818f2 (5231a8d)

## Environment
- Node.js: v24.13.1
- npm: 11.8.0

## Command Outputs

### node --version
```text
v24.13.1
```

### npm --version
```text
11.8.0
```

### npm ci
```text
added 72 packages, and audited 75 packages in 14s

9 packages are looking for funding
  run `npm fund` for details

1 high severity vulnerability

To address all issues, run:
  npm audit fix --force

Run `npm audit` for details.
```

### npm run typecheck
```text
> 4444555-arcade@0.1.0 typecheck
> tsc --noEmit -p packages/game-sdk/tsconfig.json && tsc --noEmit -p apps/portal/tsconfig.json
```

### npm test
```text
> 4444555-arcade@0.1.0 test
> node --test tests/*.test.mjs

✔ games are kept behind the platform SDK boundary (3.852ms)
✔ manifest identifies a versioned game and SDK (0.6524ms)
✔ asset budgets are internally consistent (0.1312ms)
✔ Gravity Courier is lazy-loaded and version-aligned (4.0287ms)
✔ production flight preserves accepted visuals and exposes a complete game loop (1.7659ms)
✔ Pages fallback contains true unlit obstacle correction 0.15 (11.584ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 92.2432
```

### npm run build
```text
> 4444555-arcade@0.1.0 build
> npm run build --workspace @4444555/portal


> @4444555/portal@0.1.0 build
> vite build

vite v7.1.12 building for production...
transforming...
✓ 728 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                           0.57 kB │ gzip:   0.35 kB
dist/assets/GravityCourierGate-BEY8x6SX.css              10.92 kB │ gzip:   3.07 kB
dist/assets/index-d4K_sOh1.css                           14.86 kB │ gzip:   4.48 kB
dist/assets/kernelBlurVaryingDeclaration-BQWi3jje.js      0.29 kB │ gzip:   0.22 kB │ map:     0.87 kB
dist/assets/kernelBlurVaryingDeclaration-Di2UnhQj.js      0.30 kB │ gzip:   0.23 kB │ map:     0.89 kB
dist/assets/pointCloudVertex-CubeElmu.js                  0.31 kB │ gzip:   0.25 kB │ map:     0.86 kB
dist/assets/logDepthDeclaration-D-9kiR8C.js               0.34 kB │ gzip:   0.27 kB │ map:     0.90 kB
dist/assets/logDepthDeclaration-BmNjtjZW.js               0.35 kB │ gzip:   0.27 kB │ map:     0.92 kB
dist/assets/pass.fragment-BbN6Kxrz.js                     0.41 kB │ gzip:   0.31 kB │ map:     0.89 kB
dist/assets/glowMapMerge.vertex-Cbb8QQGc.js               0.53 kB │ gzip:   0.36 kB │ map:     1.05 kB
dist/assets/postprocess.vertex-uR2A1GkZ.js                0.56 kB │ gzip:   0.37 kB │ map:     1.07 kB
dist/assets/bloomMerge.fragment-BA81MMTe.js               0.58 kB │ gzip:   0.38 kB │ map:     1.08 kB
dist/assets/packingFunctions-DEK_YKS-.js                  0.60 kB │ gzip:   0.34 kB │ map:     1.14 kB
dist/assets/rgbdEncode.fragment-kGH18z5v.js               0.62 kB │ gzip:   0.41 kB │ map:     1.39 kB
dist/assets/rgbdDecode.fragment-vGN8Wq3z.js               0.63 kB │ gzip:   0.41 kB │ map:     1.40 kB
dist/assets/packingFunctions-9olLq3a3.js                  0.63 kB │ gzip:   0.35 kB │ map:     1.19 kB
dist/assets/glowMapMerge.vertex-BwELe5fs.js               0.64 kB │ gzip:   0.40 kB │ map:     1.18 kB
dist/assets/postprocess.vertex-DU_62iZU.js                0.68 kB │ gzip:   0.42 kB │ map:     1.22 kB
dist/assets/logDepthVertex-DqGjG6v2.js                    0.70 kB │ gzip:   0.40 kB │ map:     2.22 kB
dist/assets/rgbdEncode.fragment-CoyJcbUU.js               0.76 kB │ gzip:   0.44 kB │ map:     1.56 kB
dist/assets/rgbdDecode.fragment-D4WT2g5u.js               0.77 kB │ gzip:   0.45 kB │ map:     1.57 kB
dist/assets/extractHighlights.fragment-DZIxa_nV.js        0.79 kB │ gzip:   0.47 kB │ map:     1.59 kB
dist/assets/bloomMerge.fragment-B_uDDDq2.js               0.84 kB │ gzip:   0.45 kB │ map:     1.35 kB
dist/assets/sharpen.fragment-Bs6lMWzj.js                  0.85 kB │ gzip:   0.46 kB │ map:     1.36 kB
dist/assets/grain.fragment-CRAcQkiW.js                    0.87 kB │ gzip:   0.51 kB │ map:     1.64 kB
dist/assets/logDepthVertex-DMFqK-Xj.js                    0.89 kB │ gzip:   0.44 kB │ map:     2.48 kB
dist/assets/mainUVVaryingDeclaration-Czh9Zx_2.js          0.90 kB │ gzip:   0.47 kB │ map:     2.54 kB
dist/assets/glowMapMerge.fragment-B0f42zqS.js             0.90 kB │ gzip:   0.49 kB │ map:     1.52 kB
dist/assets/mainUVVaryingDeclaration-BkCAMYAS.js          0.92 kB │ gzip:   0.46 kB │ map:     2.59 kB
dist/assets/circleOfConfusion.fragment-BOxsvNPk.js        0.92 kB │ gzip:   0.52 kB │ map:     1.51 kB
dist/assets/kernelBlur.vertex-CIU81jsf.js                 1.00 kB │ gzip:   0.53 kB │ map:     2.43 kB
dist/assets/extractHighlights.fragment-CxNcc7dI.js        1.01 kB │ gzip:   0.53 kB │ map:     1.83 kB
dist/assets/imageProcessing.fragment-D8IhBU4d.js          1.02 kB │ gzip:   0.55 kB │ map:     2.14 kB
dist/assets/mesh.vertexData.functions-ayNlGC5K.js         1.02 kB │ gzip:   0.54 kB │ map:     6.51 kB
dist/assets/fxaa.vertex-CEhhSHo1.js                       1.09 kB │ gzip:   0.46 kB │ map:     1.58 kB
dist/assets/circleOfConfusion.fragment-Dv_wb0Cb.js        1.09 kB │ gzip:   0.59 kB │ map:     1.70 kB
dist/assets/glowMapMerge.fragment-BpcEyw_-.js             1.16 kB │ gzip:   0.56 kB │ map:     1.80 kB
dist/assets/kernelBlur.vertex-CT-jIaOm.js                 1.16 kB │ gzip:   0.57 kB │ map:     2.64 kB
dist/assets/grain.fragment-BFKUS0MO.js                    1.17 kB │ gzip:   0.58 kB │ map:     1.96 kB
dist/assets/sharpen.fragment-CaS77Qw6.js                  1.18 kB │ gzip:   0.52 kB │ map:     1.70 kB
dist/assets/imageProcessing.fragment-BBVnEGX-.js          1.21 kB │ gzip:   0.60 kB │ map:     2.36 kB
dist/assets/glowBlurPostProcess.fragment-5927OUKI.js      1.23 kB │ gzip:   0.65 kB │ map:     1.76 kB
dist/assets/clipPlaneVertex-DkOuWcHd.js                   1.24 kB │ gzip:   0.39 kB │ map:     2.50 kB
dist/assets/clipPlaneFragment-Bxna9f6m.js                 1.24 kB │ gzip:   0.41 kB │ map:     2.58 kB
dist/assets/depth.fragment-LtNYeEN7.js                    1.27 kB │ gzip:   0.61 kB │ map:     2.48 kB
dist/assets/defaultUboDeclaration-DZANeiTj.js             1.30 kB │ gzip:   0.59 kB │ map:     1.91 kB
dist/assets/clipPlaneFragment-CTIHXLQH.js                 1.34 kB │ gzip:   0.42 kB │ map:     2.70 kB
dist/assets/fogFragment-Dry2b4xr.js                       1.36 kB │ gzip:   0.62 kB │ map:     3.01 kB
dist/assets/ddsTextureLoader-Dc-7_w2s.js                  1.41 kB │ gzip:   0.70 kB │ map:     5.72 kB
dist/assets/clipPlaneVertex-huzlaQUN.js                   1.42 kB │ gzip:   0.42 kB │ map:     2.71 kB
dist/assets/depth.fragment-CPQjMg9k.js                    1.49 kB │ gzip:   0.67 kB │ map:     2.75 kB
dist/assets/glowBlurPostProcess.fragment-B5ZKO0Rc.js      1.52 kB │ gzip:   0.72 kB │ map:     2.07 kB
dist/assets/fxaa.vertex-CTpRxOHY.js                       1.53 kB │ gzip:   0.51 kB │ map:     2.04 kB
dist/assets/fogFragment-BxnsDC6U.js                       1.53 kB │ gzip:   0.68 kB │ map:     3.21 kB
dist/assets/chromaticAberration.fragment-BHrsPoyr.js      1.64 kB │ gzip:   0.66 kB │ map:     2.18 kB
dist/assets/defaultUboDeclaration-C0QXcNMs.js             1.66 kB │ gzip:   0.57 kB │ map:     2.27 kB
dist/assets/depthOfFieldMerge.fragment-DomZjEfP.js        1.79 kB │ gzip:   0.63 kB │ map:     2.44 kB
dist/assets/chromaticAberration.fragment-BZMomh7R.js      2.00 kB │ gzip:   0.74 kB │ map:     2.54 kB
dist/assets/glowMapGeneration.fragment-C63-8kow.js        2.00 kB │ gzip:   0.79 kB │ map:     3.37 kB
dist/assets/particles.fragment-C8IEzPAU.js                2.18 kB │ gzip:   0.94 kB │ map:     3.98 kB
dist/assets/depth.vertex-CCbNu3Vi.js                      2.33 kB │ gzip:   0.94 kB │ map:     5.62 kB
dist/assets/depth.vertex-CFONFNI5.js                      2.37 kB │ gzip:   0.92 kB │ map:     5.04 kB
dist/assets/depthOfFieldMerge.fragment-Dlk66VPJ.js        2.41 kB │ gzip:   0.64 kB │ map:     3.03 kB
dist/assets/kernelBlur.fragment-Bp04nMpq.js               2.41 kB │ gzip:   0.84 kB │ map:     4.82 kB
dist/assets/hdrTextureLoader-BGQvgh0h.js                  2.45 kB │ gzip:   1.18 kB │ map:    16.14 kB
dist/assets/dds-c3idEdlS.js                               2.46 kB │ gzip:   1.29 kB │ map:    12.95 kB
dist/assets/glowMapGeneration.vertex-DmhM16Bv.js          2.48 kB │ gzip:   0.86 kB │ map:     5.13 kB
dist/assets/particles.fragment-DRUKGclQ.js                2.49 kB │ gzip:   0.96 kB │ map:     4.40 kB
dist/assets/glowMapGeneration.fragment-zbPG-kaP.js        2.64 kB │ gzip:   0.90 kB │ map:     4.05 kB
dist/assets/iesTextureLoader-Cw3p41qI.js                  2.80 kB │ gzip:   1.23 kB │ map:    12.29 kB
dist/assets/glowMapGeneration.vertex-BKX38Npv.js          2.90 kB │ gzip:   0.94 kB │ map:     5.72 kB
dist/assets/kernelBlur.fragment-aqnuHolg.js               2.94 kB │ gzip:   0.91 kB │ map:     5.44 kB
dist/assets/tgaTextureLoader-DmUZZkKJ.js                  3.62 kB │ gzip:   1.44 kB │ map:    19.77 kB
dist/assets/cubemapToSphericalPolynomial-08kVqlJv.js      3.75 kB │ gzip:   1.68 kB │ map:    21.38 kB
dist/assets/dumpTools-DepLulBM.js                         3.78 kB │ gzip:   1.85 kB │ map:    17.78 kB
dist/assets/particles.vertex-BB-tgyxP.js                  4.77 kB │ gzip:   1.40 kB │ map:     6.49 kB
dist/assets/imageProcessingFunctions-CouH_vtR.js          4.85 kB │ gzip:   1.76 kB │ map:     6.50 kB
dist/assets/imageProcessingFunctions-CC75mpPO.js          5.58 kB │ gzip:   1.98 kB │ map:     7.35 kB
dist/assets/fxaa.fragment-Cbhb06At.js                     5.64 kB │ gzip:   1.70 kB │ map:     6.41 kB
dist/assets/particles.vertex-CPk0-2Ac.js                  5.86 kB │ gzip:   1.51 kB │ map:     7.67 kB
dist/assets/fxaa.fragment-DBRwcJpK.js                     6.52 kB │ gzip:   1.77 kB │ map:     7.32 kB
dist/assets/helperFunctions-_anjqn0M.js                   6.55 kB │ gzip:   2.22 kB │ map:     7.61 kB
dist/assets/helperFunctions-CWl8aLC6.js                   6.86 kB │ gzip:   2.33 kB │ map:     8.10 kB
dist/assets/dds.pure-CE3W1DjO.js                          7.11 kB │ gzip:   2.52 kB │ map:    38.62 kB
dist/assets/default.vertex-B9bys4Ip.js                    7.91 kB │ gzip:   2.25 kB │ map:    14.44 kB
dist/assets/envTextureLoader-D0OwwsdS.js                  8.00 kB │ gzip:   3.21 kB │ map:    50.59 kB
dist/assets/basisTextureLoader-BvH93wGh.js                8.06 kB │ gzip:   3.24 kB │ map:    40.04 kB
dist/assets/vertexColorMixing-kjRzjZG6.js                 8.06 kB │ gzip:   2.04 kB │ map:    15.71 kB
dist/assets/default.vertex-CEaj-g3v.js                    9.37 kB │ gzip:   2.45 kB │ map:    16.33 kB
dist/assets/bakedVertexAnimation-PjmGFL3I.js             13.00 kB │ gzip:   2.50 kB │ map:    19.81 kB
dist/assets/pbr.vertex-7DOrt1jh.js                       14.27 kB │ gzip:   3.08 kB │ map:    21.06 kB
dist/assets/exrTextureLoader-D4pIkTjO.js                 14.28 kB │ gzip:   5.28 kB │ map:    98.91 kB
dist/assets/harmonicsFunctions-BTLHfOe6.js               14.78 kB │ gzip:   5.02 kB │ map:    17.47 kB
dist/assets/bakedVertexAnimation-Bof0pDQi.js             15.91 kB │ gzip:   2.65 kB │ map:    23.05 kB
dist/assets/harmonicsFunctions-DiAn7Gsu.js               16.50 kB │ gzip:   5.18 kB │ map:    19.22 kB
dist/assets/ktxTextureLoader-hC0Ne9If.js                 16.52 kB │ gzip:   4.84 kB │ map:    65.25 kB
dist/assets/pbr.vertex-tOMk_Itb.js                       16.82 kB │ gzip:   3.58 kB │ map:    24.45 kB
dist/assets/vertexColorMixing-Dn5lIaFE.js                23.18 kB │ gzip:   3.82 kB │ map:    32.43 kB
dist/assets/default.fragment-COxSKC1I.js                 23.86 kB │ gzip:   5.76 kB │ map:    33.24 kB
dist/assets/default.fragment-CdcHFnVX.js                 25.58 kB │ gzip:   5.75 kB │ map:    34.76 kB
dist/assets/oitFragment-CL4DAIja.js                      76.96 kB │ gzip:  14.77 kB │ map:    93.46 kB
dist/assets/oitFragment-mCGFKO7Z.js                      83.47 kB │ gzip:  15.45 kB │ map:    98.40 kB
dist/assets/pbr.fragment-DRVaPE7Z.js                    135.49 kB │ gzip:  25.77 kB │ map:   183.88 kB
dist/assets/pbr.fragment-C89EjkO7.js                    139.73 kB │ gzip:  25.87 kB │ map:   188.04 kB
dist/assets/index-CrqUw7tn.js                           207.48 kB │ gzip:  65.49 kB │ map:   933.90 kB
dist/assets/GravityCourierGate-FdYeoGSY.js            1,563.17 kB │ gzip: 378.86 kB │ map: 7,022.16 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 17.11s
```

### du -sh apps/portal/dist
```text
12M	apps/portal/dist
```
