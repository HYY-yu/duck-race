import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {World} from '../src/world';
import {IslandTerrain} from '../src/island-terrain';
import {WHEEL,wheelContacts} from '../src/wheel-collision';
import {Race} from '../src/simulation';
import {obstacles,sample,world} from '../src/track';

test('valley surroundings have upward front faces and share the terrain boundary',()=>{
 // Build the production geometry without a WebGL renderer or optional asset loading.
 const view=Object.create(World.prototype) as World;
 const field=new IslandTerrain();Object.assign(view,{terrainField:field,scene:new THREE.Scene()});
 Reflect.get(view,'surroundings').call(view);
 const mesh=view.scene.getObjectByName('valley-surroundings') as THREE.Mesh;
 const p=mesh.geometry.attributes.position,index=mesh.geometry.index!;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<index.count;i+=3){
  a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));
  assert.ok(b.sub(a).cross(c.sub(a)).y>0,`downward terrain triangle ${i/3}`);
 }
 for(let i=0;i<=field.cols;i++)assert.equal(p.getY(i),field.heights[i]);
 assert.equal((mesh.material as THREE.Material).side,THREE.FrontSide);
});

test('rotor hits the spoke interior, paddle edges and hub at every rotation',()=>{
 for(let i=0;i<80;i++){
  const time=i*.17,a=time*.9,c=Math.cos(a),s=Math.sin(a);
  for(const [x,z]of [[0,1.3],[.9,2.6],[0,0]]){
   assert.ok(wheelContacts(c*x+s*z,-s*x+c*z,-.19,time).length>0);
  }
 }
 assert.equal(wheelContacts(0,2.6,2,0).length,0,'airborne duck clears the rotor');
 assert.equal(wheelContacts(0,2.6,-3,0).length,0,'duck below rotor does not collide');
 assert.equal(wheelContacts(5,5,0,0).length,0,'open water stays open');
});

test('wheel body clearance encloses the shipped duck model at its displayed size',()=>{
 const bytes=readFileSync(new URL('../public/models/duck.glb',import.meta.url)),length=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length);
 const accessor=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION],view=gltf.bufferViews[accessor.bufferView];
 const scale=1.9/(accessor.max[1]-accessor.min[1]),cx=(accessor.min[0]+accessor.max[0])/2,cz=(accessor.min[2]+accessor.max[2])/2;
 for(let i=0;i<accessor.count;i++){
  const offset=(view.byteOffset??0)+(accessor.byteOffset??0)+i*12;
  const radius=Math.hypot(bin.readFloatLE(offset)-cx,bin.readFloatLE(offset+8)-cz)*scale;
  assert.ok(radius<=WHEEL.duckRadius,'visible duck body must fit inside its rotor collider');
 }
});

function penetration(race:Race,s:number){
 const d=race.ducks[0],p=sample(s),v=world(d.s,d.lane),dx=v.x-p.x,dz=v.z-p.z;
 return Math.max(0,...wheelContacts(dx*p.tz-dz*p.tx,dx*p.tx+dz*p.tz,d.y-p.y,race.time).map(h=>h.depth));
}
test('wheel remains solid during contact cooldown and 50 ms high-speed steps',()=>{
 for(const o of obstacles.filter(o=>o.kind==='wheel'||o.kind==='windmill'))for(const phase of [0,.4,.9,1.5]){
  const race=new Race(2,42),d=race.ducks[0];race.state='racing';race.time=phase;
  race.ducks[1].finish=0;
  d.s=o.s-4.5;d.lane=-1.3;d.y=sample(d.s).y-.19;d.v=32;d.cooldown=.35;
  let closest=Infinity;
  for(let i=0;i<22;i++){
   race.step(.05);closest=Math.min(closest,Math.abs(d.s-o.s));
   assert.ok(penetration(race,o.s)<.02,`rotor overlap at phase=${phase}, step=${i}`);
   assert.ok([d.s,d.lane,d.v,d.lv].every(Number.isFinite));
  }
  assert.ok(closest<4,'duck actually reaches the rotor');
 }
});

test('ordinary races keep every duck outside rotor solids through the full passage',()=>{
 for(const seed of [1,42,917]){
  const race=new Race(12,seed);race.start();while(race.state==='countdown')race.step(1/60);
  for(let i=0;i<60*90&&race.state!=='finished';i++){
   race.step(1/60);
   for(const d of race.ducks)for(const o of obstacles){
    if((o.kind!=='wheel'&&o.kind!=='windmill')||Math.abs(d.s-o.s)>6)continue;
    const p=sample(o.s),v=world(d.s,d.lane),dx=v.x-p.x,dz=v.z-p.z;
    const depth=Math.max(0,...wheelContacts(dx*p.tz-dz*p.tx,dx*p.tx+dz*p.tz,d.y-p.y,race.time).map(h=>h.depth));
    assert.ok(depth<.03,`seed ${seed}, duck ${d.id}, depth ${depth}`);
   }
  }
  assert.equal(race.state,'finished');
 }
});

if(process.env.DUCK_SOLIDS_CHILD!=='1')test('solid geometry regression also passes on the mountain course',()=>{
 const {NODE_TEST_CONTEXT:_context,...environment}=process.env;
 const output=execFileSync(process.execPath,['--import','tsx','--test',fileURLToPath(import.meta.url)],{env:{...environment,DUCK_TRACK:'mountain',DUCK_SOLIDS_CHILD:'1'},encoding:'utf8',timeout:30000});
 assert.match(output,/tests 5/);
 assert.match(output,/fail 0/);
});
