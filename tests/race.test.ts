import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/simulation';
import {TRACK_LENGTH,RUNOUT_LENGTH,LAKE_LEVEL,width,flow,world} from '../src/track';
const run=(n:number,seed:number)=>{const r=new Race(n,seed);r.start();for(let step=0;step<60*180&&r.state!=='finished';step++)r.step(1/60);return r;};
test('only integral counts from 2 through 12 are accepted',()=>{for(const n of [0,1,13,3.5,NaN])assert.throws(()=>new Race(n));for(const n of [2,3,6,12])assert.equal(new Race(n).ducks.length,n)});
test('ready, countdown and pause never advance duck positions',()=>{const r=new Race(6);const initial=r.ducks.map(d=>d.s);r.step(1/60);r.start();for(let i=0;i<60;i++)r.step(1/60);r.pause();const time=r.time;for(let i=0;i<60;i++)r.step(1/60);assert.deepEqual(r.ducks.map(d=>d.s),initial);assert.equal(r.time,time);assert.equal(r.state,'paused');r.pause();assert.equal(r.state,'countdown')});
test('2 to 12 ducks all finish with finite states and ordered unique results',()=>{for(let n=2;n<=12;n++){for(const seed of [1,42,917]){const r=run(n,seed);assert.equal(r.state,'finished',`count ${n} seed ${seed}`);assert.equal(new Set(r.results.map(d=>d.id)).size,n);r.results.forEach((d,i)=>{assert.ok(Number.isFinite(d.finish));assert.ok(Number.isFinite(d.lane));assert.ok(Math.abs(d.lane)<=width(d.s));if(i)assert.ok(d.finish!>=r.results[i-1].finish!);});}}});
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


test('finished ducks float into the lake while official results and race time stay fixed',()=>{
 const r=run(12,42),time=r.time,results=r.results.map(d=>({id:d.id,time:d.finish})),start=r.ducks.map(d=>d.s);
 for(let i=0;i<60*90;i++)r.step(1/60);
 assert.equal(r.state,'finished');assert.equal(r.time,time);
 assert.deepEqual(r.results.map(d=>({id:d.id,time:d.finish})),results);
 for(const d of r.ducks){assert.ok(d.s>start[d.id]);assert.ok(d.s>TRACK_LENGTH+20);assert.ok(d.s<=TRACK_LENGTH+RUNOUT_LENGTH);assert.ok(Math.abs(d.y-(LAKE_LEVEL-.19))<.3);assert.ok(Object.values(world(d.s,d.lane)).every(Number.isFinite));}
 r.reset(6,42);assert.equal(r.floatTime,0);assert.ok(r.ducks.every(d=>d.finish===null));
});
test('pausing a race also freezes racers who have already finished',()=>{
 const r=new Race(6,42);r.start();for(let i=0;i<10800&&!r.results.length;i++)r.step(1/60);
 assert.ok(r.results.length>0&&r.results.length<6);r.pause();const before=JSON.stringify(r);
 for(let i=0;i<180;i++)r.step(1/60);assert.equal(JSON.stringify(r),before);
});
test('river mouth joins the lake at the same level and continues beyond the finish',()=>{
 const end=world(TRACK_LENGTH),after=world(TRACK_LENGTH+.001);assert.ok(Math.abs(end.y-LAKE_LEVEL)<1e-9);assert.ok(Math.hypot(after.x-end.x,after.z-end.z)<.002);assert.ok(Math.abs(after.y-end.y)<.001);
});
