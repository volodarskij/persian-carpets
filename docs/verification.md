# Release verification — 1.0.0

## Android

Both flavor release builds and Android lint passed. Lint has one advisory for intentional fixed landscape orientation. APK Signature Scheme v2 verification passed; package IDs are distinct.

Installed and launched both APKs on Android 9/API 28, Mali-450 MP. Recorded moving-frame samples:

| Mode | FPS | Largest observed frame interval | Geometry stalls | GL errors |
| --- | --- | --- | --- | --- |
| Morph | 30.4–31.1 | 115 ms | 0 | 0 |
| Zoom | 21.3–21.7 | 61 ms | 0 | 0 |

The initial direct zoom port ran at 2.1–2.2 FPS. Profiling showed repeated per-pixel boundary and union evaluations dominated the frame. The optimized Android path:

- Calculates a signed distance field once and reuses it for material and junction masks.
- Clips large gardens with stencil and a contour-following fan, avoiding repeated fragment contour calculations.
- Uses a smaller body mesh for distant levels and skips subpixel ornament.
- Clips microflower masks to the actual petal coverage, including the valleys between petals.
- Uses a 480×270 quarter framebuffer and 192×108 distance cache on Mali-400/450. Other GPUs use up to a 960-pixel-wide quarter and 320-pixel-wide distance cache. Color boundaries remain flat; distance interpolation reconstructs geometry, not flowing color gradients.

Both modes run from their own launcher entry and share their rendering session with the Android DreamService. The selected system screensaver is not changed by installation or launch.

## Geometry and desktop

- 18 native/browser shader exports match their shared source.
- Native bridge poses have stable part counts, vertex correspondence and packed sizes.
- Main and fine-detail meshes, polygon fans and exact morph endpoints pass.
- Both derivative and finite-difference union shaders pass neck coverage, outline thickness and flat pigment checks.
- Cached-field interior samples agree with direct evaluation; stencil tests preserve petal tips and clear petal valleys.
- Actual desktop WebGL shows exact mirror symmetry, no GL errors and small image differences through recursive zoom boundaries: mean 0.35–0.42 on a 0–255 scale for a 2 ms step.
- Desktop controls, pause, fullscreen, keyboard, narrow layout and offline rendering were exercised.

The native optimized renderer also received an independent static review of its lifecycle, pose queue, framebuffer restoration, stencil state and LOD groups. Device timings describe the test samples only; startup and background scheduling can cause occasional longer frames.

## Projector 24 FPS tuning

The current native zoom tuning measures 24.8–25.6 changing frames/s on the Mali-450 projector at a 1120×630 reconstructed image (560×315 quarter framebuffer). This trades some spatial resolution for motion and mipmapped detail stability. It is not a locked frame-pacing claim: isolated cache updates reached 90 ms in the measured run.

The renderer uses four separately refreshed pattern caches, live coarse geometry, endpoint-safe viewport culling, and one stencil clear per assembled frame. Distance-field sampling is restored explicitly before the junction mask. Native pose, geometry and actual GLSL checks pass; an independent review found no remaining correctness issues.
