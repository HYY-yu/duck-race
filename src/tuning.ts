/** Code-only feel controls. No duck ID, rank, or player input changes propulsion. */
export const FEEL = {
 launchSlope: .95,
 stuckSeconds: 2.5,
 escapeImpulse: 2.4,
 bendNarrowing: .27,
} as const;

/** Reference duck-race CFG, in the same world-unit scale. */
export const RAPIDS = {
 baseFlow:14.2, waterDrag:1.9, lateralDrag:2.6, steerMax:4.6,
 gravity:24, wallRestitution:.5, wallPenalty:.94,
 repelStrength:46, repelAlong:.45, landingRetention:.955,
} as const;
