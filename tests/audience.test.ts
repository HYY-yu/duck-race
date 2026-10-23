import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Race} from '../src/simulation';
import {TRACK_LENGTH,sample,world} from '../src/track';
import {AudienceDirector} from '../src/audience-behavior';
import {BridgeAudience} from '../src/bridge-audience';
function nearFinish(){const race=new Race(6,42);race.state='racing';race.time=race.floatTime=50;race.ducks.forEach((d,i)=>{d.s=TRACK_LENGTH-4-i*4;d.y=sample(d.s).y-.19;});return race;}
test('spectators divide their attention and react with individual delays and gestures',()=>{
 const race=nearFinish(),director=new AudienceDirector();director.update(race);
 assert.ok(new Set(director.viewers.map(v=>v.target)).size>=3);
 race.ducks[0].finish=50;race.results.push(race.ducks[0]);director.update(race);
 race.time=race.floatTime=50.2;director.update(race);assert.equal(director.viewers[0].action,'hop');assert.equal(director.viewers[1].action,'watch');
 race.time=race.floatTime=50.8;director.update(race);assert.equal(director.viewers[1].action,'clap');assert.equal(director.viewers[2].action,'wave');assert.equal(director.viewers[3].action,'watch');
 race.time=race.floatTime=51.1;director.update(race);assert.equal(director.viewers[3].action,'both');assert.equal(new Set(director.viewers.map(v=>v.action)).size,4);
 const targets=director.viewers.map(v=>v.target);assert.ok(new Set(targets).size>=2);
 race.pause();const before=JSON.stringify(director.viewers);for(let i=0;i<60;i++)director.update(race);assert.equal(JSON.stringify(director.viewers),before);
 race.reset(6,42);director.update(race);assert.ok(director.viewers.every(v=>v.action==='watch'&&v.target===null&&v.reactionAt===Infinity));
});
test('spectator gaze tracks moving racers, stays bounded and freezes while paused',()=>{
 const bridge=new THREE.Group();bridge.position.set(-1,3.4,40);bridge.rotation.y=-.3;
 const audience=new BridgeAudience(bridge),race=nearFinish();audience.update(0,race);
 const heads=Array.from({length:4},(_,i)=>bridge.getObjectByName(`spectator-gaze-${i}`)!);
 const before=heads.map(h=>h.rotation.y);
 for(let step=0;step<90;step++){race.floatTime+=1/60;race.time=race.floatTime;race.ducks.forEach(d=>{d.s+=.18;d.y=sample(d.s).y-.19;});audience.update(step/60,race);}
 assert.ok(heads.some((h,i)=>Math.abs(h.rotation.y-before[i])>.05));
 for(const head of heads){assert.ok(Math.abs(head.rotation.y)<=1.15+.0001);assert.ok(Math.abs(head.rotation.x)<=.45+.0001);}
 bridge.updateMatrixWorld(true);for(const viewer of audience.diagnostics){if(viewer.target===null)continue;const duck=race.ducks[viewer.target],p=world(duck.s,duck.lane),head=heads[viewer.viewer],origin=head.getWorldPosition(new THREE.Vector3()),toward=new THREE.Vector3(p.x,duck.y+1,p.z).sub(origin).normalize();assert.ok(head.getWorldDirection(new THREE.Vector3()).dot(toward)>.85,'gaze must face the tracked duck');}
 race.pause();audience.update(2,race);const pose=()=>{const values:number[]=[];bridge.traverse(o=>values.push(...o.position.toArray(),...o.quaternion.toArray()));return values;};const paused=pose();
 for(let i=0;i<90;i++)audience.update(20+i/60,race);assert.deepEqual(pose(),paused);
});
