# YouTube version local acceptance

Date: 2026-10-27 (Asia/Singapore).

## Results

- `npm test`: 146 passed, 0 failed. Tests ran with local HTTP permissions because an existing PostHog mock collector opens a loopback server. New tests cover held-input combination/release/reset, fixed bilingual duck labels and actual simulation steering.
- `npm run build`: passed, including existing SEO checks. `SITE_URL` was not configured in this local build.
- `npm run build:youtube`: passed, including SDK ordering, relative asset references, output isolation and excluded-capability checks.
- All 39 website output files retained identical SHA-256 hashes before and after the YouTube build. The website output contains neither the Playables SDK reference nor the YouTube entry diagnostic marker.
- In-app browser: chose duck 03, started race, held D, confirmed `controlled=true` and released axis `0`.
- Mobile viewport 390×844: switched to Chinese, chose duck 06, started race, held the on-screen right control, confirmed selected ID `5`, `controlled=true`, released axis `0`. This used browser pointer input, not a physical touchscreen.
- User pause: state `paused`, axis `0`, race time remained `22.716666666666328` seconds across observations.
- Layout checked at desktop default, 390×844 portrait and 844×390 landscape. Temporary viewport overrides were reset. The ready screen hides directional controls so the start button remains unobstructed.
- Built output served on loopback port 5185: game UI rendered, model resources loaded, and browser captured no warning/error logs at inspection.
- No deployment, push, Cloudflare setting change or website entry/runtime modification.

## Evidence

- [Desktop built preview](desktop-ready.png)
- [Mobile paused race](mobile-paused.png)

## Remaining platform acceptance

These checks used a local browser preview, not an onboarded Playables channel or the YouTube mobile apps. Official SDK Test Suite, live platform lifecycle, physical multi-touch, Android/iOS device performance and certification remain outstanding. See [YouTube integration notes](../../YOUTUBE.md).
