import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FinishPresentation,RESULTS_DELAY} from '../src/finish-presentation';
import {FollowCamera,stableLookAt} from '../src/follow-camera';

test('results wait for visible lake viewing time and the last duck entering the lake',()=>{
 const p=new FinishPresentation(),race={generation:1,state:'racing',ducks:[{s:8},{s:9}]};
 assert.deepEqual(p.update(race,1,true,10),{started:false,reveal:false});
 race.state='finished';assert.deepEqual(p.update(race,0,true,10),{started:true,reveal:false});
 assert.equal(p.update(race,RESULTS_DELAY,true,10).reveal,false);
 race.ducks[0].s=11;race.ducks[1].s=12;assert.equal(p.update(race,0,true,10).reveal,true);
 p.shown=true;assert.deepEqual(p.update(race,5,true,10),{started:false,reveal:false});
});
test('hidden pages and open modals do not consume the arrival viewing delay; reset cancels it',()=>{
 const p=new FinishPresentation(),race={generation:1,state:'finished',ducks:[{s:12}]};
 p.update(race,2,true,10);for(let i=0;i<20;i++)assert.equal(p.update(race,1,false,10).reveal,false);
 assert.equal(p.age,2);race.generation++;race.state='ready';p.update(race,0,true,10);
 assert.equal(p.age,0);assert.equal(p.started,false);assert.equal(p.shown,false);
 race.state='finished';assert.equal(p.update(race,0,true,10).started,true);
 assert.equal(p.update(race,RESULTS_DELAY-.1,true,10).reveal,false);
 assert.equal(p.update(race,.2,true,10).reveal,true);
});
test('camera smoothly routes around persistent obstruction without position jumps',()=>{
 const camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3(0,1,0),tree=new THREE.Box3(new THREE.Vector3(-12,0,-16),new THREE.Vector3(-4,30,-5)),ray=new THREE.Ray(),hit=new THREE.Vector3();
 camera.position.set(-10,10,-24);
 const clear=(a:THREE.Vector3,b:THREE.Vector3)=>{ray.set(a,b.clone().sub(a).normalize());return !ray.intersectBox(tree,hit)||hit.distanceTo(a)>a.distanceTo(b);};
 const planner=new FollowCamera();let previous=camera.position.clone();
 for(let i=0;i<600;i++){planner.update(camera,target,0,1,1/60,clear);assert.ok(camera.position.distanceTo(previous)<=26/60+.0001);previous.copy(camera.position);}
 assert.equal(planner.clear,true);assert.ok(clear(target,camera.position));assert.ok(camera.position.x>0);assert.ok(camera.position.distanceTo(target)>25);assert.equal(planner.routeChanges,1);
});
test('camera holds its clear side instead of repeatedly returning to the preferred side',()=>{
 const planner=new FollowCamera(),camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3();camera.position.set(0,40,-30);
 let blocked=true;const clear=(_a:THREE.Vector3,b:THREE.Vector3)=>!blocked||b.x>0;
 for(let i=0;i<150;i++)planner.update(camera,target,0,1,1/60,clear);
 assert.equal(planner.routeChanges,1);blocked=false;
 for(let i=0;i<600;i++)planner.update(camera,target,0,1,1/60,clear);
 assert.equal(planner.routeChanges,1);assert.ok(camera.position.x>0);
});
test('brief alternating occlusion does not cause route churn or altitude snaps',()=>{
 const planner=new FollowCamera(),camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3();camera.position.set(-10,23,-24);let blocked=false;
 const clear=()=>!blocked;let previous=camera.position.clone();
 for(let i=0;i<900;i++){blocked=i%24<10;planner.update(camera,target,0,1,1/60,clear);assert.ok(Math.abs(camera.position.y-previous.y)<=12/60+.0001);previous.copy(camera.position);}
 assert.equal(planner.routeChanges,0);assert.ok(camera.position.y<24);
});
test('camera motion and view rotation stay bounded through abrupt goals and heading reversals',()=>{
 const planner=new FollowCamera(),camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3();camera.position.set(0,30,-30);
 const previous=new THREE.Vector3(),velocity=new THREE.Vector3(),lastVelocity=new THREE.Vector3();
 for(let i=0;i<480;i++){
  previous.copy(camera.position);const rotation=camera.quaternion.clone();target.set(i<120?0:20,i<240?0:-10,0);
  planner.update(camera,target,0,i<180?1:-1,1/60,()=>true,i<240?4:0);stableLookAt(camera,target,1/60);
  velocity.subVectors(camera.position,previous).multiplyScalar(60);
  assert.ok(velocity.length()<=26+.0001);assert.ok(velocity.distanceTo(lastVelocity)<=18/60+.001);lastVelocity.copy(velocity);
  assert.ok(rotation.angleTo(camera.quaternion)<=.9/60+.0001);
 }
});

test('real finishers reach the lake before automatic results, with one completion handoff',async()=>{
 const {Race}=await import('../src/simulation');const {TRACK_LENGTH}=await import('../src/track');
 const race=new Race(6,42),p=new FinishPresentation();race.start();let starts=0,revealedAt=0;
 for(let i=0;i<60*120;i++){
  race.step(1/60);const event=p.update(race,1/60,true,TRACK_LENGTH+6);if(event.started)starts++;
  if(event.reveal){revealedAt=p.age;p.shown=true;assert.ok(race.ducks.every(d=>d.s>=TRACK_LENGTH+6));break;}
 }
 assert.equal(starts,1);assert.ok(revealedAt>=RESULTS_DELAY);assert.ok(revealedAt<RESULTS_DELAY+.1);
 const official=race.time;for(let i=0;i<180;i++){race.step(1/60);assert.deepEqual(p.update(race,1/60,true,TRACK_LENGTH+6),{started:false,reveal:false});}assert.equal(race.time,official);
});
