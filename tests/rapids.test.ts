import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ImpactEffects} from '../src/impact-effects';
import {Race} from '../src/simulation';
import {createMotion,contactImpulse,stepMotion,type Body} from '../src/dynamics';
import {FollowCamera} from '../src/follow-camera';

test('landing and impact particles consume once, stay fixed while paused, expire and reset',()=>{
 const race=new Race(2,42),scene=new THREE.Scene(),effects=new ImpactEffects(scene);race.state='racing';race.time=10;
 race.events=[{seq:1,kind:'landing',duck:0,s:20,lane:0,y:20,time:10,strength:12},{seq:2,kind:'contact',source:'pendulum',duck:1,s:21,lane:1,y:21,time:10,strength:6}];
 const before=JSON.stringify(race);effects.update(race);assert.equal(JSON.stringify(race),before);assert.equal(effects.diagnostics.active,140);
 const drops=scene.getObjectByName('impact-water-and-hit-droplets') as THREE.InstancedMesh;
 const matrices=Array.from(drops.instanceMatrix.array);effects.update(race);assert.equal(effects.diagnostics.active,140);assert.deepEqual(Array.from(drops.instanceMatrix.array),matrices);
 race.time=12;effects.update(race);assert.equal(effects.diagnostics.active,0);race.reset(2,42);effects.update(race);assert.equal(effects.diagnostics.consumed,0);
});
test('contacts cannot leave a duck facing backwards; yaw returns to the flow direction',()=>{
 const d:Body={s:20,lane:0,v:4,lv:0,...createMotion(20,0)};contactImpulse(d,-2,7,0);
 for(let i=0;i<180;i++){stepMotion(d,d.s,i/60,1/60);assert.ok(Math.abs(d.yaw)<=.38);}
 assert.ok(Math.abs(d.yaw)<.06);
});
test('rapids camera takes a close rear view and keeps its near position above terrain',()=>{
 const camera=new THREE.PerspectiveCamera(65,1,.1,1000);camera.position.set(0,15,-25);const rig=new FollowCamera(true),target=new THREE.Vector3(0,1,0);
 for(let i=0;i<300;i++)rig.update(camera,target,0,1,1/60,()=>true,0,()=>0,14);
 assert.ok(camera.position.distanceTo(target)<17);assert.ok(camera.position.z<0);assert.ok(camera.position.y>4);assert.ok(rig.clear);
});
