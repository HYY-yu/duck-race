# 子任务 2：第一处瀑布的落水区（冲击白水、水雾、泡沫、入水水花）

Project root: /Volumes/GW/codes/duck-obstacle-race. The falling sheet has already been reworked (task 1). Now make the impact zone read as a powerful plunge instead of a sheet quietly sliding into the pool.

## File ownership
- Edit ONLY `src/waterfall.ts`, and inside it ONLY: `foamMaterial` + the `plunge-pool-aeration` mesh, the soft sprite texture, the quarks spray/mist `makeSystem`, the duck entry bursts, and (optionally) the five base rocks behind the sheet and the eight bank rocks.
- Do NOT touch the sheet material/geometry from task 1 (the `free-falling-water-sheet` mesh and its shader), `update`/`dispose` semantics, `src/course.ts`, `src/simulation.ts`, or any physics. No new npm dependencies, no external images.

## What is wrong now
1. The impact line is weak: no bright, dense, turbulent white band where the sheet meets the pool. The sheet just ends.
2. Mist is almost invisible. A 9 m free fall should throw a soft, rising, slowly drifting cloud that partly veils the lower third of the sheet and the pool surface, then thins out downstream.
3. Spray droplets are tiny, uniform and few; no droplets bounce back up and outward from the impact line.
4. Pool foam is a flat translucent patch with soft cells; it should be a bright boiling ring right at the impact, breaking into streaky foam lines/patches that drift downstream and fade by ~8–10 m.
5. The five base rocks are identical blobs at even spacing; the eight bank rocks are fine. Optional: vary size/rotation of the base rocks so they do not read as a row of eggs.

## Target look and techniques
- Impact band: a dense, nearly opaque white band hugging the impact line across the sheet width, with an animated, boiling edge (noise-thresholded, fast-scrolling), slightly taller in the middle than at the edges. Can be a thin vertical/curved strip or a reworked part of the pool foam mesh.
- Pool foam: brightest at impact (uv.y≈0), streaky downstream (stretch noise along flow), drifting with time, fading with distance; foam cells should move downstream, not just pulse in place.
- Mist (quarks billboard): larger, softer, more numerous particles near the impact; rise slowly and drift downstream; alpha low per particle (stack to a soft veil, no visible discs); lifetime 2–4 s. Keep total particle count reasonable (spray+mist ≲ ~600 alive).
- Spray (stretched billboard): two populations if useful — short fast droplets bouncing up/out of the impact (1–3 m high) and fine spray. Sizes vary more.
- Duck entry bursts: a crown-shaped splash (ring of droplets thrown up and outward) plus a short puff of mist, scaled by `duck.entrySpeed` if you like (do not change when/whether bursts fire).
- All motion driven by the existing clock / `batch.update` path so pause still freezes everything; reset still clears.

## Contracts (tests/waterfall.test.mjs)
- Names `headwater-waterfall`, `free-falling-water-sheet`, `quarks-waterfall-spray` stay. The batch must still contain systems that emit at least one particle after `update(...,delta=.016,paused=false)`; paused update must not move particles; dispose twice leaves the scene with only original children.
- Every new texture/material/geometry is pushed into `textures`/`materials`/`geometries` so dispose releases it.

## Verification
`npm test` (54/54) and `npm run build` must pass. Browser check:
`/Volumes/GW/program/miniconda3/bin/python /Volumes/GW/codes/duck-obstacle-race/.zcode/tools/shoot.py /tmp/duck-shots/<label>` — any shader error or new warning must be fixed (one pre-existing 404 line is harmless). The dispatcher re-runs all checks independently after you report.
