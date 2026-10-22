import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceInsights } from '../src/race-insights.ts';
import { createDucks } from '../src/simulation.ts';

test('spectator pass annotations observe position changes without changing racers', () => {
  const [a,b,c] = createDucks(42), before = structuredClone([a,b,c]), tracker = new RaceInsights();
  assert.deepEqual(tracker.update([a,b,c], 0), []);
  assert.deepEqual(tracker.update([b,a,c], 8), [{id:b.id,passed:a.id,position:1,time:8}]);
  assert.deepEqual([a,b,c],before);
  assert.equal(tracker.passCount,1);
  assert.deepEqual(tracker.update([a,b,c],8.1),[]);
  assert.deepEqual(tracker.update([b,a,c],8.2),[]);
  assert.equal(tracker.update([a,b,c],11).length,1);
});

test('start-line shuffling and finishing order do not generate false pass notices', () => {
  const [a,b] = createDucks(42), tracker = new RaceInsights();
  tracker.update([a,b],0);
  assert.deepEqual(tracker.update([b,a],1),[]);
  a.finish=2;
  assert.deepEqual(tracker.update([a,b],5),[]);
  tracker.reset();
  assert.equal(tracker.passCount,0);
  assert.deepEqual(tracker.update([b,a],10),[]);
});
