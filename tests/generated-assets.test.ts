import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODEL_IDS} from '../src/generated-assets';
import {GeneratedAssets,type ModelId} from '../src/generated-assets';
import * as THREE from 'three';
import {BridgeAudience} from '../src/bridge-audience';
import {Race} from '../src/simulation';
import {TRACK_LENGTH,sample} from '../src/track';

test('all shipped generated models have bounded geometry, finite normals and embedded textures',()=>{
 let totalBytes=0;
 for(const id of MODEL_IDS){
  const bytes=readFileSync(new URL(`../public/models/${id}.glb`,import.meta.url));totalBytes+=bytes.length;
  assert.equal(bytes.readUInt32LE(0),0x46546c67,id);assert.equal(bytes.readUInt32LE(4),2,id);assert.equal(bytes.readUInt32LE(8),bytes.length,id);assert.ok(bytes.length<1024*1024,id);
  const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length),primitive=g.meshes[0].primitives[0];
  for(const view of g.bufferViews)assert.ok((view.byteOffset??0)+view.byteLength<=bin.length,`${id}: buffer bounds`);
  const p=g.accessors[primitive.attributes.POSITION],n=g.accessors[primitive.attributes.NORMAL],uv=g.accessors[primitive.attributes.TEXCOORD_0],indices=g.accessors[primitive.indices];
  assert.ok(indices.count/3<=10000,id);assert.equal(p.count,n.count,id);assert.equal(p.count,uv.count,id);
  const pv=g.bufferViews[p.bufferView],nv=g.bufferViews[n.bufferView],iv=g.bufferViews[indices.bufferView];
  for(let i=0;i<p.count;i++){
   for(let k=0;k<3;k++)assert.ok(Number.isFinite(bin.readFloatLE((pv.byteOffset??0)+(p.byteOffset??0)+(i*3+k)*4)),id);
   const normal=[0,1,2].map(k=>bin.readFloatLE((nv.byteOffset??0)+(n.byteOffset??0)+(i*3+k)*4));assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-4,`${id}: unit normal`);
  }
  for(let i=0;i<indices.count;i++)assert.ok((indices.componentType===5125?bin.readUInt32LE((iv.byteOffset??0)+i*4):bin.readUInt16LE((iv.byteOffset??0)+i*2))<p.count,`${id}: index bounds`);
  assert.equal(g.materials.length,1,id);assert.equal(g.materials[0].pbrMetallicRoughness.metallicFactor,0,id);
  for(const image of g.images){const v=g.bufferViews[image.bufferView],offset=v.byteOffset??0;assert.ok(bin.readUInt32BE(offset+16)<=1024,id);assert.ok(bin.readUInt32BE(offset+20)<=1024,id);}
 }
 assert.ok(totalBytes<8*1024*1024,`Total model download budget: ${totalBytes}`);
});

test('every paid batch task is receipted and the full project stays within the approved USD 2 cap',()=>{
 const ledger=JSON.parse(readFileSync(new URL('../assets/generated/remaining-v1/billing.json',import.meta.url),'utf8'));
 assert.equal(ledger.budget_usd,2);assert.ok(ledger.total_spent_usd<=2);assert.equal(ledger.items.length,17);assert.equal(new Set(ledger.items.map((i:{prediction_id:string})=>i.prediction_id)).size,17);
 assert.ok(ledger.items.every((i:{state:string;cost_usd:number})=>i.state==='done'&&i.cost_usd===.1));assert.equal(ledger.total_spent_usd,1.824);
});

test('generated spectator skin weights stay normalized and the pose freezes with the race',()=>{
 class FixtureAssets extends GeneratedAssets {
  override has(){return true;}
  override make(id:ModelId,shape:{height?:number;width?:number;center?:boolean}={height:1}){
   const bytes=readFileSync(new URL(`../public/models/${id}.glb`,import.meta.url)),length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length),primitive=g.meshes[0].primitives[0],geometry=new THREE.BufferGeometry();
   for(const [name,index]of Object.entries(primitive.attributes) as [string,number][]){const a=g.accessors[index],v=g.bufferViews[a.bufferView],width={VEC3:3,VEC2:2}[a.type as 'VEC3'|'VEC2'],data=new Float32Array(Uint8Array.from(bin.subarray(v.byteOffset,v.byteOffset+a.count*width*4)).buffer);geometry.setAttribute({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}[name]!,new THREE.BufferAttribute(data,width));}
   const a=g.accessors[primitive.indices],v=g.bufferViews[a.bufferView];geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(Uint8Array.from(bin.subarray(v.byteOffset,v.byteOffset+a.count*4)).buffer),1));geometry.computeBoundingBox();const box=geometry.boundingBox!,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale((shape.height??1)/size.y,(shape.height??1)/size.y,(shape.height??1)/size.y);return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
  }
 }
 const bridge=new THREE.Group(),audience=new BridgeAudience(bridge);audience.setGeneratedAssets(new FixtureAssets());let meshes=0;
 bridge.traverse(o=>{if(o instanceof THREE.SkinnedMesh){meshes++;const weights=o.geometry.attributes.skinWeight;for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);}});assert.equal(meshes,4);
 const race=new Race(6,42);race.state='racing';race.time=race.floatTime=50;race.ducks.forEach((d,i)=>{d.s=TRACK_LENGTH-2-i*3;d.y=sample(d.s).y-.19;});audience.update(0,race);race.ducks[0].finish=50;race.results.push(race.ducks[0]);for(let i=0;i<60;i++){race.floatTime+=1/60;race.time=race.floatTime;audience.update(i/60,race);}race.pause();audience.update(2,race);
 const pose=()=>{const values:number[]=[];bridge.traverse(o=>values.push(...o.position.toArray(),...o.quaternion.toArray()));return values;};const before=pose();for(let i=0;i<60;i++)audience.update(10+i,race);assert.deepEqual(pose(),before);bridge.updateMatrixWorld(true);bridge.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
});
