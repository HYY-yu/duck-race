import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceController, FIXED_STEP, RACE_TIMEOUT } from '../src/race.ts';
import { createDucks } from '../src/simulation.ts';

function advanceFrames(race, count, delta = 1 / 60) {
  const signals = [];
  for (let frame = 0; frame < count; frame += 1) {
    signals.push(...race.advance(delta).signals);
  }
  return signals;
}

test('three-second countdown holds every duck, then releases once', () => {
  const race = new RaceController(42);
  const startGrid = structuredClone(race.ducks);
  assert.deepEqual(race.start(42), [{ type: 'countdown' }]);
  assert.deepEqual(advanceFrames(race, 29, 0.1), []);
  assert.equal(race.phase, 'countdown');
  assert.ok(Math.abs(race.countdown - 0.1) < 1e-8);
  assert.equal(race.time, 0);
  assert.deepEqual(race.ducks, startGrid);
  assert.deepEqual(race.advance(0.1).signals, [{ type: 'start' }]);
  assert.equal(race.phase, 'running');
  assert.equal(race.time, 0);
  assert.deepEqual(race.ducks, startGrid);
  assert.deepEqual(race.advance(FIXED_STEP).signals, []);
  assert.equal(race.time, FIXED_STEP);
  assert.notDeepEqual(race.ducks, startGrid);
});

test('countdown crossing preserves only the post-release frame remainder', () => {
  const race = new RaceController();
  race.start(42);
  advanceFrames(race, 179);
  assert.equal(race.phase, 'countdown');
  assert.deepEqual(race.advance(0.025).signals, [{ type: 'start' }]);
  assert.equal(race.time, FIXED_STEP);
});

test('pausing countdown and race preserves time, positions and fixed-step remainder', () => {
  const race = new RaceController();
  assert.deepEqual(race.togglePause(), []);
  race.start(42);
  advanceFrames(race, 30);
  assert.deepEqual(race.togglePause(), [{ type: 'pause' }]);
  const remaining = race.countdown;
  const grid = structuredClone(race.ducks);
  advanceFrames(race, 300);
  assert.equal(race.countdown, remaining);
  assert.deepEqual(race.ducks, grid);
  assert.deepEqual(race.togglePause(), [{ type: 'resume' }]);
  assert.equal(race.phase, 'countdown');
  advanceFrames(race, 150);
  assert.equal(race.phase, 'running');
  race.advance(FIXED_STEP / 2);
  assert.equal(race.time, 0);
  race.togglePause();
  advanceFrames(race, 300);
  assert.equal(race.time, 0);
  race.togglePause();
  race.advance(FIXED_STEP / 2);
  assert.equal(race.time, FIXED_STEP);
});

test('reset restores seed and grid and clears a partly completed countdown', () => {
  const race = new RaceController(91);
  race.start(123);
  advanceFrames(race, 270);
  assert.ok(race.time > 0);
  assert.deepEqual(race.reset(), [{ type: 'reset' }]);
  assert.equal(race.phase, 'ready');
  assert.equal(race.time, 0);
  assert.equal(race.countdown, 3);
  assert.equal(race.seed, 123);
  assert.deepEqual(race.ducks, createDucks(123));
  race.start(7);
  race.advance(0.1);
  race.reset(91);
  assert.equal(race.seed, 91);
  assert.deepEqual(race.ducks, createDucks(91));
});

test('30, 60 and 120 FPS partitions produce the same fixed-step race', () => {
  const races = [30, 60, 120].map(fps => {
    const race = new RaceController(63);
    race.start(63);
    advanceFrames(race, fps * 12, 1 / fps);
    return { time: race.time, phase: race.phase, ducks: race.ducks };
  });
  assert.deepEqual(races[0], races[1]);
  assert.deepEqual(races[1], races[2]);
  assert.equal(races[0].time, 9);
});

test('invalid deltas cannot corrupt state and long frames are capped', () => {
  const race = new RaceController();
  race.start(42);
  for (const delta of [NaN, Infinity, -Infinity, -1, 0]) {
    assert.deepEqual(race.advance(delta), { events: [], signals: [] });
  }
  assert.equal(race.countdown, 3);
  race.advance(600);
  assert.equal(race.countdown, 2.9);
  assert.equal(race.time, 0);
  advanceFrames(race, 29, 0.1);
  race.advance(600);
  assert.equal(race.time, 0.1);
});

test('completed races emit one completion and cannot resume', () => {
  const race = new RaceController();
  race.start(42);
  advanceFrames(race, 30, 0.1);
  race.ducks.forEach(duck => { duck.finish = 0; });
  assert.deepEqual(race.advance(FIXED_STEP).signals, [{ type: 'complete' }]);
  assert.equal(race.phase, 'done');
  assert.deepEqual(race.advance(0.1), { events: [], signals: [] });
  assert.deepEqual(race.togglePause(), []);
  assert.deepEqual(race.start(99), []);
});

test('timeout is visible, emitted once and requires a reset', () => {
  const race = new RaceController();
  race.start(42);
  advanceFrames(race, 30, 0.1);
  // Keep one unresolved racer without mutating the simulation or adding a rescue.
  // An empty grid cannot exercise timeout because it is already complete.
  const duck = race.ducks[0];
  let timeoutSignals = 0;
  for (let frame = 0; frame < RACE_TIMEOUT * 10 + 1 && !race.timedOut; frame += 1) {
    race.ducks = [structuredClone(createDucks(42)[duck.id])];
    timeoutSignals += race.advance(0.1).signals.filter(signal => signal.type === 'timeout').length;
  }
  assert.equal(timeoutSignals, 1);
  assert.equal(race.phase, 'paused');
  assert.equal(race.time, RACE_TIMEOUT);
  assert.equal(race.timedOut, true);
  assert.deepEqual(race.togglePause(), []);
  assert.deepEqual(race.advance(1), { events: [], signals: [] });
  race.reset();
  assert.equal(race.timedOut, false);
  assert.equal(race.phase, 'ready');
});
