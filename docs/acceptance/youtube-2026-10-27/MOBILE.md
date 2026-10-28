# YouTube version mobile browser acceptance

Date: 2026-10-27 (Asia/Singapore). Scope: YouTube entry only; website code and deployment unchanged.

## Findings and fixes

- Narrow-screen toolbar previously clipped the language selector. Replaced mobile camera/sound text with accessible SVG buttons, shortened the English language option to EN, and retained 44px touch targets.
- Duck choices were less than 44px wide on the narrowest screen. Narrow portrait now uses four columns; short landscape uses a wider compact panel with six columns.
- Short landscape could hide Start race below the panel viewport. Compacted the panel, removed redundant setup instructions in this layout, and kept the action visible. Status is placed beside the panel.
- Mobile operation hints now describe holding the directional buttons. Desktop keyboard hints remain available.
- Finished state shows rankings instead of the setup grid. Rankings are only rebuilt when their data/language changes, preserving scroll during ongoing rendering. Race again returns to selection so another duck can be chosen.

## Browser checks

Measured CSS viewport sizes: 320×568, 390×844, 568×320 and 844×390. The browser zoom required proportionally larger viewport overrides; results use the measured DOM dimensions, not the override values.

English and Chinese setup/race layouts were measured for horizontal overflow, viewport clipping, center-point hit testing and target size. All tested visible buttons/selects had at least approximately 44×44 CSS pixel targets (fractional layout rounding accepted). Pause and complete-race views were also inspected. Machine-readable observations are in [mobile-layout-audit.json](mobile-layout-audit.json).

A held on-screen right button set the selected racer to controlled mode; releasing returned steering to zero. Pause disabled steering and the race resumed after portrait/landscape changes. A complete 12-duck race reached the results screen. Rankings and replay were checked through browser interaction.

Validation: 146 unit tests passed; YouTube build and isolation checker passed. All 39 previously built website files retained identical SHA-256 values. No deployment or push performed.

## Evidence and limits

- [Portrait race](mobile-racing.png)
- [Landscape race](mobile-landscape.png)
- [Rankings](mobile-results.png)

This is browser viewport and pointer-input acceptance. It does not establish physical multi-touch behavior, device heat/power use, sustained mobile FPS or compatibility inside the YouTube Android/iOS apps. Those require real devices and an approved Playables environment.
