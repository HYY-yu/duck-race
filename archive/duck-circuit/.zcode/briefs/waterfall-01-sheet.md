# 子任务 1：重做第一处瀑布的水帘本体

派发对象：`duck-dev`（deepseek-v4.1-flash）。总控负责验收。

You are improving the visual quality of the first waterfall ("headwater") in the Duck Circuit project at /Volumes/GW/codes/duck-obstacle-race. The user says the waterfall looks stiff ("过于生硬"). This task covers ONLY the falling water sheet itself. A later task will handle the plunge pool foam, mist and spray, so do not touch those.

## File ownership
- You may edit ONLY `src/waterfall.ts`, and inside it ONLY the sheet section: the sheet `MeshPhysicalMaterial` + its `onBeforeCompile`, the sheet geometry loop, and the two "edge" side-wall meshes (currently roughly lines 16–78).
- Do NOT touch: the rock meshes, `foamMaterial`/`plunge-pool-aeration`, the quarks spray/mist systems, duck entry bursts, `update`/`dispose` logic (except removing the `geometries`/`materials` pushes for things you delete).
- Do NOT edit `src/course.ts`, `src/simulation.ts` or any physics. Purely visual. No new npm dependencies, no external images.

## What is wrong now (art director's diagnosis from screenshots)
1. It reads as a bent sheet of tinted glass/plastic: constant width, constant thickness, perfectly straight vertical side edges, plus 0.13 m side-wall meshes that draw a hard outline. Real free-falling water has a thick glassy "tongue" leaving the lip, then becomes unstable, its edges fray into separate strands, and it spreads slightly and breaks up before impact.
2. The surface texture is many evenly spaced thin vertical lines with uniform contrast — it looks like a rain texture painted on the sheet, not falling mass. No thick ropes/cords of water, no see-through gaps between them.
3. Colour is a uniform pale translucent teal top to bottom. Real falls are dark, smooth and glassy (reflective) at the lip, progressively aerated/white downward, nearly opaque white in the lower third.
4. The bottom ends as a clean slab entering the pool; it should tear apart into holes and white churn just before impact.
5. The undulation is one global `sin(u*49+t*15)` fold, so the whole sheet ripples in lock-step.

## Target look and suggested techniques (keep code dense like the rest of the file)
- Vertical structure keyed on `uv.y` (0 = lip, 1 = impact; uv.y is proportional to flight time, so constant scrolling in uv.y already reads as gravity acceleration — keep that):
  - 0–~0.15: smooth glassy tongue. Dark teal-green core (~#2a6f68 → #3f8f86), roughness ~0.05–0.1, strong env reflection, bright specular roll highlight at the lip; almost no white.
  - ~0.15–0.6: white streaks appear and widen; low-frequency lateral noise (x frequency ~2–4 across the width) forms thicker brighter cords with thinner, more transparent gaps. Fine streaks secondary, lower contrast.
  - ~0.6–1.0: mostly aerated white (~#eef7f4, roughness ~0.5–0.6, less transmission, higher opacity where white), with noise-thresholded alpha holes growing toward the bottom so the sheet tears apart. Still reads as one waterfall.
- Edges: animated-noise alpha fade near uv.x = 0 / 1 so edges fray into strands; fray width grows with uv.y. Remove the two side-wall edge meshes.
- Shape (CPU geometry): ~56 columns × ~96 rows. Slight contraction below the lip, spreading to 1.05–1.08× lip width near the bottom (never > 1.08× upper.width). Per-column lateral/forward jitter growing with t. Rows at uv.y = 0 and 1 keep EXACTLY their current y.
- Animation (vertex shader): replace the lock-step fold with layered undulations whose phase travels downward and varies across columns; amplitude grows with uv.y, ≲ 0.12 m.
- Fresnel/grazing brightening welcome. Bump `customProgramCacheKey` to `'headwater-sheet-v2'`.
- All animation driven by the existing `clock` uniform so pause freezes it.

## Contracts (tests/waterfall.test.mjs)
- Names: `headwater-waterfall`, `free-falling-water-sheet`, `quarks-waterfall-spray`.
- Sheet geometry has `position` and `uv`; uv.y === 0 vertices at lip surface y + 0.035, uv.y === 1 at impact surface y + 0.035 (1e-4); finite; vertical extent > 9.
- dispose() leaves only original scene children; safe to call twice.

## Verification before reporting
1. `npm test` (54/54) and `npm run build`; include summary lines.
2. Dev server already on port 5182 (HMR; do not start another):
   `/Volumes/GW/program/miniconda3/bin/python /Volumes/GW/codes/duck-obstacle-race/.zcode/tools/shoot.py /tmp/duck-shots/agent1`
   Saves agent1-idle/-fall/-splash/-after.png and prints console warnings/errors. One "Failed to load resource: 404" line is pre-existing; any `THREE.WebGLProgram`/shader error or new warning must be fixed.

## Report back (short)
Sections changed, visual effect of each, test/build lines, browser console result, open doubts.
