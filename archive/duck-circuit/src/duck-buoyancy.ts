import { bankDistanceAt, curvatureAt, sampleChannel, sampleCourse, type Route } from './course.ts';
import { waterWave } from './water-wave.ts';

export type FloatState = { heave: number; verticalVelocity: number; pitch: number; pitchVelocity: number; roll: number; rollVelocity: number };
type FloatingBody = { s: number; lateral: number; heading: number; route?: Route };
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const HULL_CENTRE_ABOVE_WATER = .28;
export const HULL_LOCAL_CENTRE = .46;

/** Four probes under the hull respond to water slope and the same surface waves
 * drawn by the shader. None of these targets contains a steering angle.
 */
export function buoyancyTarget(body: FloatingBody, time: number) {
  const f = sampleCourse(body.s), route = body.route ?? 'main';
  const along = Math.cos(body.heading) * f.tx + Math.sin(body.heading) * f.tz;
  const across = Math.cos(body.heading) * f.nx + Math.sin(body.heading) * f.nz;
  const metric = clamp(1 - curvatureAt(body.s) * body.lateral, .65, 1.35);
  const height = (ds: number, dl: number) => {
    const s = body.s + ds / metric, span = sampleChannel(s, route);
    const lateral = clamp(body.lateral + dl, span.min + .025, span.max - .025);
    return span.y + .035 + waterWave(s, lateral, bankDistanceAt(s,lateral,route), time);
  };
  const span = sampleChannel(body.s, route);
  const heave = .035 + waterWave(body.s, body.lateral, bankDistanceAt(body.s,body.lateral,route), time);
  const bow = height(along * .55, across * .55), stern = height(-along * .55, -across * .55);
  // Local +Z is the duck's right side: (-sin heading, cos heading).
  const rightAlong = -Math.sin(body.heading) * f.tx + Math.cos(body.heading) * f.tz;
  const rightAcross = -Math.sin(body.heading) * f.nx + Math.cos(body.heading) * f.nz;
  const right = height(rightAlong * .42, rightAcross * .42), left = height(-rightAlong * .42, -rightAcross * .42);
  return { heave, pitch: clamp(Math.atan2(bow - stern, 1.1), -.75, .75), roll: clamp(-Math.atan2(right - left, .84), -.5, .5) };
}

export function createFloatState(body: FloatingBody, time: number): FloatState {
  return { ...buoyancyTarget(body, time), verticalVelocity: 0, pitchVelocity: 0, rollVelocity: 0 };
}

/** Damped buoyancy has a short inertial lag. Fixed substeps keep long frames stable;
 * heave is relative to the local waterline. Free flight overrides this pose in the scene.
 */
export function updateFloatState(state: FloatState, body: FloatingBody, time: number, delta: number, paused: boolean) {
  if (!Number.isFinite(time) || !Number.isFinite(delta) || delta < 0) throw new RangeError('Invalid buoyancy time.');
  if (paused || delta === 0) return;
  const dt = Math.min(.1, delta), steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
  const target = buoyancyTarget(body, time);
  for (let i = 0; i < steps; i++) {
    state.verticalVelocity += ((target.heave - state.heave) * 46 - state.verticalVelocity * 7) * h;
    state.heave = clamp(state.heave + state.verticalVelocity * h, -.07, .14);
    state.pitchVelocity += ((target.pitch - state.pitch) * 36 - state.pitchVelocity * 7.5) * h;
    state.rollVelocity += ((target.roll - state.roll) * 30 - state.rollVelocity * 5.8) * h;
    state.pitch = clamp(state.pitch + state.pitchVelocity * h, -.8, .8);
    state.roll = clamp(state.roll + state.rollVelocity * h, -.55, .55);
  }
}
