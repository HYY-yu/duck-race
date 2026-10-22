import { COURSE_LENGTH, curvatureAt, flowAt, sampleChannel, sampleCourse } from './course.ts';

export type RotationState = { heading: number; angularVelocity: number };
type FloatingPosition = { s: number; lateral: number; route?: 'main' | 'left' | 'right' };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const MAX_ANGULAR_SPEED = 1.8;

/** Rotational water drag acts on spin, never on a desired heading. Uniform still
 * water damps existing rotation without deciding which way a floating body faces.
 */
export function applyRotationalDrag(body: RotationState, waterSpin: number, dt: number) {
  if (!Number.isFinite(waterSpin) || !Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid rotational water input.');
  const response = 1 - Math.exp(-1.4 * dt);
  body.angularVelocity += (clamp(waterSpin, -.9, .9) - body.angularVelocity) * response;
  body.angularVelocity = clamp(body.angularVelocity, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED);
}

export function integrateHeading(body: RotationState, dt: number) {
  const angle = body.heading + body.angularVelocity * dt;
  body.heading = Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Approximate local fluid angular velocity as half the world-space curl.
 * Sampling follows the actual channel and never looks through a solid island.
 */
export function waterSpinAt(body: FloatingPosition, time: number): number {
  const frame = sampleCourse(body.s), span = sampleChannel(body.s, body.route ?? 'main');
  const worldVelocity = (s: number, lateral: number) => {
    const f = sampleCourse(s), channel = sampleChannel(s, body.route ?? 'main');
    const l = clamp(lateral, channel.min + .04, channel.max - .04), flow = flowAt(s, l, time);
    return { x: f.tx * flow.forward + f.nx * flow.lateral, z: f.tz * flow.forward + f.nz * flow.lateral };
  };
  const sm = Math.max(0, body.s - .3), sp = Math.min(COURSE_LENGTH, body.s + .3);
  const lm = Math.max(span.min + .04, body.lateral - .3), lp = Math.min(span.max - .04, body.lateral + .3);
  const a = worldVelocity(sm, body.lateral), b = worldVelocity(sp, body.lateral);
  const c = worldVelocity(body.s, lm), d = worldVelocity(body.s, lp);
  const metric = clamp(1 - curvatureAt(body.s) * body.lateral, .65, 1.35);
  const ds = Math.max(.01, (sp - sm) * metric), dl = Math.max(.01, lp - lm);
  const vxS = (b.x - a.x) / ds, vzS = (b.z - a.z) / ds;
  const vxL = (d.x - c.x) / dl, vzL = (d.z - c.z) / dl;
  return clamp(.5 * (frame.tx * vzS + frame.nx * vzL - frame.tz * vxS - frame.nz * vxL), -.9, .9);
}

/** An asymmetric rubber duck has a small pressure lever around its body centre.
 * Off-centre contact transfers angular impulse; this supplies no propulsion.
 */
export function applyContactSpin(body: FloatingPosition & RotationState, impulseS: number, impulseL: number) {
  const f = sampleCourse(body.s);
  const jx = f.tx * impulseS + f.nx * impulseL, jz = f.tz * impulseS + f.nz * impulseL;
  const torque = .14 * (Math.cos(body.heading) * jz - Math.sin(body.heading) * jx);
  body.angularVelocity = clamp(body.angularVelocity + torque / .24, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED);
}
