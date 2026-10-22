import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/simulation';
import {TRACK_LENGTH,width,flow,world} from '../src/track';
const run=(n:number,seed:number)=>{const r=new Race(n,seed);r.start();for(let step=0;step<60*180&&r.state!=='finished';step++)r.step(1/60);return r;};
test('only integral counts from 3 through 12 are accepted',()=>{for(const n of [0,2,13,3.5,NaN])assert.throws(()=>new Race(n));for(const n of [3,6,12])assert.equal(new Race(n).ducks.length,n)});
test('ready, countdown and pause never advance duck positions',()=>{const r=new Race(6);const initial=r.ducks.map(d=>d.s);r.step(1/60);r.start();for(let i=0;i<60;i++)r.step(1/60);r.pause();const time=r.time;for(let i=0;i<60;i++)r.step(1/60);assert.deepEqual(r.ducks.map(d=>d.s),initial);assert.equal(r.time,time);assert.equal(r.state,'paused');r.pause();assert.equal(r.state,'countdown')});
test('3 to 12 ducks all finish with finite states and ordered unique results',()=>{for(let n=3;n<=12;n++){for(const seed of [1,42,917]){const r=run(n,seed);assert.equal(r.state,'finished',`count ${n} seed ${seed}`);assert.equal(new Set(r.results.map(d=>d.id)).size,n);r.results.forEach((d,i)=>{assert.ok(Number.isFinite(d.finish));assert.ok(Number.isFinite(d.lane));assert.ok(Math.abs(d.lane)<=width(d.s));if(i)assert.ok(d.finish!>=r.results[i-1].finish!);});}}});
test('seeded races reproduce results and reset clears all previous state',()=>{const a=run(12,123),b=run(12,123);assert.deepEqual(a.results,b.results);a.reset(3,123);assert.equal(a.results.length,0);assert.equal(a.time,0);assert.equal(a.state,'ready');assert.ok(a.ducks.every(d=>d.finish===null&&d.v===0));});
test('track has finite geometry, narrow reach and accelerating fan reach',()=>{assert.ok(width(94)<width(30));assert.ok(flow(160,0,0)>flow(145,0,0));for(let s=0;s<TRACK_LENGTH;s+=.5){const p=world(s);assert.ok(Object.values(p).every(Number.isFinite));}});
test('seeds change winners rather than imposing a winner',()=>{const winners=new Set(Array.from({length:12},(_,i)=>run(6,i+1).results[0].id));assert.ok(winners.size>=3)});

test('every racer experiences both falls, with finite landing and contact motion',()=>{
 const r=run(12,4281);assert.equal(r.state,'finished');
 for(const d of r.ducks){assert.equal(d.landings,2);assert.ok(d.entrySpeed>5);assert.ok(!d.airborne);assert.ok([d.y,d.vy,d.pitch,d.roll,d.yaw].every(Number.isFinite));}
 assert.ok(r.ducks.some(d=>d.hits>0));
});
test('pause freezes flight, angular velocities and the event queue',()=>{
 const r=new Race(6,42);r.start();for(let i=0;i<9000&&!r.ducks.some(d=>d.airborne);i++)r.step(1/60);
 assert.ok(r.ducks.some(d=>d.airborne));r.pause();const state=JSON.stringify({ducks:r.ducks,events:r.events,time:r.time});
 for(let i=0;i<180;i++)r.step(1/60);assert.equal(JSON.stringify({ducks:r.ducks,events:r.events,time:r.time}),state);
});
