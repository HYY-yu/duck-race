/** Shared surface displacement for GPU water vertices and CPU buoyancy probes. */
const waves = [
  { amplitude: .034, along: 2.2, across: 1.7, frequency: .7 },
  { amplitude: .012, along: 4.1, across: -3.5, frequency: 1.1 },
];
export function waterWave(s: number, lateral: number, bankDistance: number, time: number) {
  const edge = Math.max(0, Math.min(1, bankDistance / .55)), fade = edge * edge * (3 - 2 * edge);
  const clock = (time % 20) * Math.PI * 2;
  return fade * waves.reduce((height, wave) => height + wave.amplitude * Math.sin(s * wave.along + lateral * wave.across - clock * wave.frequency), 0);
}
export const WATER_WAVE_GLSL = `
float riverSurfaceWave(float s, float lateral, float bankDistance, float time) {
  float waveClock = mod(time, 20.0) * 6.283185307;
  return smoothstep(0.0, .55, bankDistance) * (${waves.map(w => `${w.amplitude} * sin(s * ${w.along} + lateral * ${w.across} - waveClock * ${w.frequency})`).join(' + ')});
}
`;
