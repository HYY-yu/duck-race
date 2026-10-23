import assert from 'node:assert/strict';
import {Race} from '../src/simulation';
import {TRACK_LENGTH,STANDARD_TRACK_LENGTH,LONG_COURSE,RAINBOWS,SLIDE,WINDMILL_S,LAKE_LEVEL,sample,world,FALLS,flow,FLOW_MULTIPLIER} from '../src/track';
import {IslandTerrain} from '../src/island-terrain';
import {addLongCourseProps} from '../src/course-props';
import * as THREE from 'three';
console.info=()=>{};console.debug=()=>{};
assert.ok(LONG_COURSE);assert.ok(TRACK_LENGTH>=STANDARD_TRACK_LENGTH*2);
assert.ok(Math.abs(sample(TRACK_LENGTH).y-LAKE_LEVEL)<1e-8);
assert.ok(sample(SLIDE.start).y-sample(SLIDE.end).y>2);
for(let s=0;s<TRACK_LENGTH;s+=.25)assert.ok(Object.values(sample(s)).every(Number.isFinite));
const terrain=new IslandTerrain();
for(let s=0;s<TRACK_LENGTH;s+=2){const p=world(s);assert.ok(terrain.height(p.x,p.z)<p.y+.1,'terrain must not cover the river');}
const scene=new THREE.Scene(),moving:{kind:string;root:THREE.Group;part:THREE.Group}[]=[];
addLongCourseProps(scene,moving,(x,z)=>terrain.height(x,z));
assert.equal(scene.children.filter(c=>c.name==='rainbow-arch').length,2);
for(const root of scene.children.filter(c=>c.name==='rainbow-arch')){
 const arch=root.children[0] as THREE.Mesh<THREE.RingGeometry>;
 assert.ok(arch.geometry.parameters.innerRadius>sample(RAINBOWS[0]).width-.2);
 const station=RAINBOWS[scene.children.filter(c=>c.name==='rainbow-arch').indexOf(root)];
 assert.ok(Math.sqrt(arch.geometry.parameters.innerRadius**2-(sample(station).width-.65)**2)>=3.3-1e-9,'duck accessories need headroom across every lane');
}
assert.ok(scene.getObjectByName('waterslide-chute'));assert.ok(scene.getObjectByName('mill-waterwheel'));
assert.ok(moving.some(m=>m.kind==='wind-rotor'));assert.ok(WINDMILL_S<TRACK_LENGTH-10);
// The longer route retains its course-owned current multiplier, but all ducks
// enter that current from rest just like they do on Snowpeak Rapids.
assert.equal(FLOW_MULTIPLIER,1.25);assert.ok(flow(0,0,0)>=14.2*1.25);
const launch=new Race(12,42),initialS=launch.ducks.map(d=>d.s);
assert.ok(launch.ducks.every(d=>d.v===0));launch.start();launch.step(1/60);launch.pause();
for(let i=0;i<240;i++)launch.step(1/60);
assert.ok(launch.ducks.every(d=>d.v===0));assert.deepEqual(launch.ducks.map(d=>d.s),initialS);
launch.pause();for(let i=0;i<240&&launch.state==='countdown';i++)launch.step(1/60);
assert.equal(launch.state,'racing');assert.deepEqual(launch.ducks.map(d=>d.s),initialS);
assert.ok(launch.ducks.every(d=>d.v===0));
launch.pause();const paused=JSON.stringify(launch.ducks);for(let i=0;i<240;i++)launch.step(1/60);assert.equal(JSON.stringify(launch.ducks),paused);
launch.reset(12,42);assert.ok(launch.ducks.every(d=>d.v===0));
const runs=[];
for(const count of [2,6,12])for(const seed of [1,42,917]){
 const race=new Race(count,seed);race.start();let windContacts=0,slidePasses=new Set<number>();
 for(let i=0;i<60*300&&race.state!=='finished';i++){
  race.step(1/60);
  for(const d of race.ducks){assert.ok([d.s,d.lane,d.y,d.pitch,d.roll].every(Number.isFinite));if(d.s>SLIDE.end)slidePasses.add(d.id);}
  windContacts+=race.events.filter(e=>e.time>=race.time-1/60&&e.kind==='contact'&&Math.abs(e.s-WINDMILL_S)<4).length;
 }
 assert.equal(race.state,'finished',`count=${count}, seed=${seed}`);assert.equal(slidePasses.size,count);
 assert.ok(race.ducks.every(d=>d.landings===FALLS.length));
 assert.equal(new Set(race.results.map(d=>d.id)).size,count);
 runs.push({count,seed,time:race.time,windContacts});
}
assert.ok(runs.some(r=>r.windContacts>0),'windmill paddles participate in collisions');
assert.ok(Math.max(...runs.map(r=>r.time))<25,'snowpeak current should carry every sampled long race home within 25 seconds');
console.log(JSON.stringify({length:TRACK_LENGTH,ratio:TRACK_LENGTH/STANDARD_TRACK_LENGTH,runs}));
