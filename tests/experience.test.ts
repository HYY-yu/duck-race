import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IslandTerrain,terrainNoise} from '../src/island-terrain';
import {sample,TRACK_LENGTH,FALLS} from '../src/track';
import {Race} from '../src/simulation';
import {RaceFeedback} from '../src/race-feedback';
import {noiseSamples,soundGain,voiceCue} from '../src/audio-scene';

const terrain=new IslandTerrain();
test('island terrain is finite, submerged at its boundary, and continuous across grid diagonals',()=>{
 assert.ok(terrain.heights.every(Number.isFinite));
 for(let x=-67;x<=67;x+=2){assert.ok(terrain.height(x,-82)<0);assert.ok(terrain.height(x,76)<0);}
 for(let z=-82;z<=76;z+=2){assert.ok(terrain.height(-67,z)<0);assert.ok(terrain.height(67,z)<0);}
 for(let x=-40;x<40;x+=3)for(let z=-45;z<40;z+=3){const y=terrain.height(x+.5,z+.5);assert.ok(Math.abs(terrain.height(x+.50001,z+.5)-y)<.01);assert.ok(Math.abs(terrain.height(x+.5,z+.50001)-y)<.01);}
});
test('terrain keeps the river centre submerged outside unsupported waterfall gaps',()=>{
 for(let s=0;s<TRACK_LENGTH;s+=.5){if(FALLS.some(f=>s>f.lip-1.8&&s<f.impact+1.8))continue;const p=sample(s);assert.ok(terrain.height(p.x,p.z)<p.y-.2,`river obstructed at ${s}: terrain ${terrain.height(p.x,p.z)}, water ${p.y}`);}
});
test('noise is deterministic, bounded and continuous across lattice boundaries',()=>{
 for(let x=-10;x<=10;x+=.13){const a=terrainNoise(x,1.3);assert.equal(a,terrainNoise(x,1.3));assert.ok(Math.abs(a)<=1);}
 assert.ok(Math.abs(terrainNoise(2-.00001,3)-terrainNoise(2+.00001,3))<.001);
});
test('race feedback confirms an overtake with a margin and never mutates the race',()=>{
 const r=new Race(3,42),f=new RaceFeedback();r.state='racing';r.time=r.floatTime=4;
 r.ducks[0].s=8;r.ducks[1].s=10;r.ducks[2].s=0;f.update(r);assert.equal(f.notices.length,0);
 r.time=r.floatTime=6;r.ducks[0].s=12;const before=JSON.stringify(r);f.update(r);assert.equal(JSON.stringify(r),before);
 assert.deepEqual(f.notices.map(n=>[n.kind,n.duck,n.other]),[['pass',0,1]]);
 r.time=r.floatTime=6.1;r.ducks[0].s=9.9;f.update(r);assert.equal(f.notices.length,1);
 r.reset(3,42);f.update(r);assert.equal(f.notices.length,0);assert.ok(f.hits.every(t=>t<0));
});
test('contact feedback consumes events once, ignores stale events and clears on reset',()=>{
 const r=new Race(3,42),f=new RaceFeedback();r.state='racing';r.time=r.floatTime=10;
 r.events=[{seq:1,kind:'contact',duck:1,s:20,lane:0,y:20,time:10,strength:4}];f.update(r);assert.equal(f.hits[1],10);assert.equal(f.notices.length,1);
 f.update(r);assert.equal(f.notices.length,1);
 r.events.push({seq:2,kind:'landing',duck:0,s:50,lane:0,y:20,time:9,strength:10});f.update(r);assert.equal(f.notices.length,1);
 r.floatTime=13;f.update(r);assert.equal(f.notices.length,0);
 r.reset(3,42);f.update(r);assert.equal(f.hits[1],-99);
});
test('audio sources are bounded and reproducible; distance attenuates rather than boosts volume',()=>{
 const a=noiseSamples(48000),b=noiseSamples(48000);assert.deepEqual(a,b);assert.notDeepEqual(a,noiseSamples(48000,42));
 assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<=.65));
 assert.ok(Math.abs(a.reduce((sum,v)=>sum+v,0)/a.length)<.01);
 assert.equal(soundGain(0),1);assert.equal(soundGain(28),.5);assert.ok(soundGain(100)<soundGain(20));assert.equal(soundGain(Infinity),0);
});
test('voice acknowledgements distinguish left and right without excessive pan',()=>{
 const left=voiceCue(-1),right=voiceCue(1);assert.ok(left.startHz<right.startHz);assert.ok(left.endHz<right.endHz);assert.ok(left.pan<0&&right.pan>0);assert.ok(Math.abs(left.pan)<=1&&Math.abs(right.pan)<=1);
});
