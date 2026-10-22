import test from 'node:test';
import assert from 'node:assert/strict';
import { createDucks, step } from '../src/simulation.ts';
import { sampleCourse, sampleChannel, RIVER_REACHES } from '../src/course.ts';
import { applyRotationalDrag, integrateHeading, applyContactSpin, waterSpinAt, MAX_ANGULAR_SPEED } from '../src/duck-rotation.ts';
import { buoyancyTarget, createFloatState, updateFloatState, HULL_CENTRE_ABOVE_WATER } from '../src/duck-buoyancy.ts';
import { waterWave } from '../src/water-wave.ts';

test('uniform water never steers a resting duck toward its velocity or a heading target', () => {
  const a = { heading: .2, angularVelocity: 0 }, b = { heading: 2.4, angularVelocity: 0 };
  for (let i = 0; i < 1200; i++) for (const duck of [a, b]) {
    applyRotationalDrag(duck, 0, 1 / 120); integrateHeading(duck, 1 / 120);
  }
  assert.ok(Math.abs(a.heading - .2) < 1e-10);
  assert.ok(Math.abs(b.heading - 2.4) < 1e-10);
});

test('rotational drag dissipates spin while angular inertia continues the turn', () => {
  const body = { heading: 0, angularVelocity: 1 };
  for (let i = 0; i < 120; i++) { applyRotationalDrag(body, 0, 1 / 120); integrateHeading(body, 1 / 120); }
  assert.ok(body.heading > .4 && body.heading < .8);
  assert.ok(body.angularVelocity > .1 && body.angularVelocity < .4);
  const before = { ...body };
  applyRotationalDrag(body, 0, 0); integrateHeading(body, 0);
  assert.deepEqual(body, before);
  assert.throws(() => applyRotationalDrag(body, NaN, .01), RangeError);
  assert.throws(() => applyRotationalDrag(body, 0, -.01), RangeError);
});

test('opposite off-centre contact impulses create opposite bounded rotation', () => {
  const a = { ...createDucks(42)[0], heading: .4 }, b = { ...a };
  applyContactSpin(a, 0, 2); applyContactSpin(b, 0, -2);
  assert.ok(Math.abs(a.angularVelocity) > .05);
  assert.ok(Math.abs(a.angularVelocity + b.angularVelocity) < 1e-12);
  for (let i = 0; i < 100; i++) applyContactSpin(a, 100, -100);
  assert.ok(Number.isFinite(a.angularVelocity) && Math.abs(a.angularVelocity) <= MAX_ANGULAR_SPEED);
});

test('fluid spin is finite and bounded through both branches and cascade edges', () => {
  for (const reach of RIVER_REACHES) for (let i = 0; i <= 30; i++) {
    const s = reach.start + (reach.end - reach.start) * i / 30, span = sampleChannel(s, reach.route);
    for (const lane of [.08, .5, .92]) {
      const spin = waterSpinAt({ s, lateral: span.min + (span.max - span.min) * lane, route: reach.route }, 37);
      assert.ok(Number.isFinite(spin) && Math.abs(spin) <= .9);
    }
  }
});

test('independent headings cannot supply propulsion or change the racing trajectory', () => {
  const a = createDucks(42), b = createDucks(42);
  b.forEach(duck => { duck.heading += 1.1; });
  let sideways = false, backwards = false;
  for (let tick = 1; tick <= 120 * 45; tick++) {
    step(a, tick / 120, 1 / 120); step(b, tick / 120, 1 / 120);
    for (let i = 0; i < a.length; i++) {
      assert.deepEqual([a[i].s, a[i].lateral, a[i].vs, a[i].vl], [b[i].s, b[i].lateral, b[i].vs, b[i].vl]);
      assert.ok(Number.isFinite(a[i].heading) && Math.abs(a[i].angularVelocity) <= MAX_ANGULAR_SPEED);
      const f = sampleCourse(a[i].s), dot = Math.cos(a[i].heading) * f.tx + Math.sin(a[i].heading) * f.tz;
      if (Math.abs(dot) < .3) sideways = true;
      if (dot < -.3) backwards = true;
    }
  }
  assert.ok(sideways && backwards, 'actual river drift includes side-on and backwards poses');
});

test('buoyancy probes pitch down or up according to which end meets a steep drop', () => {
  const f = sampleCourse(292), heading = Math.atan2(f.tz, f.tx);
  const body = { s: 292, lateral: 0, heading, route: 'main' };
  assert.ok(buoyancyTarget(body, 10).pitch < -.25);
  assert.ok(buoyancyTarget({ ...body, heading: heading + Math.PI }, 10).pitch > .25);
  assert.ok(Math.abs(buoyancyTarget({ ...body, heading: heading + Math.PI / 2 }, 10).roll) > .2);
});

test('buoyancy stays partially immersed, rocks with waves and freezes on pause', () => {
  const body = { s: 15, lateral: 0, heading: .8, route: 'main' }, original = { ...body };
  const state = createFloatState(body, 0), heights = [], rolls = [];
  for (let tick = 1; tick <= 120 * 20; tick++) {
    const time = tick / 120;
    updateFloatState(state, body, time, 1 / 120, false);
    assert.ok(Object.values(state).every(Number.isFinite));
    const span = sampleChannel(body.s, 'main');
    const surface = .035 + waterWave(body.s, 0, (span.max - span.min) / 2, time);
    const bottom = HULL_CENTRE_ABOVE_WATER + state.heave - .45 - surface;
    assert.ok(bottom < -.03 && bottom > -.3, 'body crosses the waterline instead of hovering on top');
    heights.push(state.heave); rolls.push(state.roll);
  }
  assert.ok(Math.max(...heights) - Math.min(...heights) > .03);
  assert.ok(Math.max(...rolls) - Math.min(...rolls) > .03);
  const frozen = { ...state };
  updateFloatState(state, body, 21, .1, true);
  assert.deepEqual(state, frozen);
  assert.deepEqual(body, original, 'buoyancy cannot steer or move the racer');
  assert.throws(() => updateFloatState(state, body, NaN, .1, false), RangeError);
});

test('buoyancy remains stable with long render frames and sharp water-level transitions', () => {
  const body = { s: 180, lateral: 0, heading: .4, route: 'main' }, state = createFloatState(body, 0);
  for (let tick = 1; tick < 600; tick++) {
    body.s = 180 + tick / 20; body.heading += .01;
    updateFloatState(state, body, tick * .1, .1, false);
    assert.ok(Object.values(state).every(Number.isFinite));
    assert.ok(state.heave >= -.07 && state.heave <= .14);
    assert.ok(Math.abs(state.pitch) <= .8 && Math.abs(state.roll) <= .55);
  }
});

test('surface waves are periodic and vanish at the bank', () => {
  for (const s of [4, 92, 185, 292]) for (const time of [0, 3.99, 4.01, 3611]) {
    assert.ok(Math.abs(waterWave(s, .4, 0, time)) < 1e-12);
    assert.ok(Math.abs(waterWave(s, .4, 2, time) - waterWave(s, .4, 2, time + 20)) < 1e-12);
    assert.ok(Math.abs(waterWave(s, .4, 2, time)) <= .046001);
  }
});
