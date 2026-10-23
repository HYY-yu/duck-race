import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mountainAnchors} from '../src/mountain-course';
import {Race} from '../src/simulation';
import {FEEL} from '../src/tuning';
import {validateHistory,resultText} from '../src/draw';

test('mountain seeds reproduce paths and change actual geometry',()=>{
 assert.deepEqual(mountainAnchors(42),mountainAnchors(42));assert.notDeepEqual(mountainAnchors(42),mountainAnchors(917));
});
test('eight track seeds complete 2/6/12 ducks, expose asymmetric flow, and keep terrain below water',()=>{
 for(const seed of [0,1,42,917,4281,65535,876543,4294967295]){
  const output=execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./mountain.fixture.ts',import.meta.url))],{env:{...process.env,DUCK_TRACK:'mountain',DUCK_SEED:String(seed)},encoding:'utf8',timeout:30000});
  assert.equal(JSON.parse(output.trim()).runs.length,3);
 }
});
test('paddling changes only lateral input and accepts bounded finite controls',()=>{
 const a=new Race(2,42),b=new Race(2,42);for(const r of [a,b]){r.start();while(r.state==='countdown')r.step(1/60);}
 b.setSteering(0,100);a.step(1/60);b.step(1/60);
 assert.equal(a.ducks[0].v,b.ducks[0].v);assert.equal(a.ducks[0].s,b.ducks[0].s);
 assert.ok(Math.abs(b.ducks[0].lv-a.ducks[0].lv-FEEL.steerAcceleration/60)<1e-9);
 assert.equal(b.controlled,true);assert.equal(a.controlled,false);b.setSteering(0,NaN);assert.equal(b.steering.axis,0);
 b.pause();const state=JSON.stringify(b.ducks);b.step(1/60);assert.equal(JSON.stringify(b.ducks),state);
 b.reset(2,42);assert.equal(b.controlled,false);assert.equal(b.steering.axis,0);
});
test('stalled duck receives an observable lateral escape without a forward teleport',()=>{
 const race=new Race(2,42);race.start();while(race.state==='countdown')race.step(1/60);
 const d=race.ducks[0];d.s=15;d.progressS=15;d.v=0;d.stuckTime=FEEL.stuckSeconds;const s=d.s;
 race.step(1/60);assert.equal(d.recoveries,1);assert.ok(Math.abs(d.lv)>1);assert.ok(d.s-s<.01);
});
test('history preserves track seed and manual steering in exported results',()=>{
 const records=validateHistory([{date:new Date().toISOString(),seed:917,trackSeed:42,controlled:true,course:'mountain',mode:'ranking',results:[{id:0,time:1},{id:1,time:2}]}]);
 assert.equal(records.length,1);assert.equal(records[0].trackSeed,42);assert.equal(records[0].controlled,true);
 assert.match(resultText(records[0],'en',String),/Track seed: 42/);assert.match(resultText(records[0],'zh',String),/人工拨水/);
});
