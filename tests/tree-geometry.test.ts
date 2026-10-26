import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {treeShadowGeometry,treeDistantGeometry} from '../src/tree-geometry';
import {createTreeBatches} from '../src/tree-batches';

function shippedTree(id:string){
 const bytes=readFileSync(new URL(`../public/models/${id}.glb`,import.meta.url)),length=bytes.readUInt32LE(12);
 const g=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length),primitive=g.meshes[0].primitives[0],geometry=new THREE.BufferGeometry();
 for(const [semantic,name,width]of [['POSITION','position',3],['NORMAL','normal',3],['TEXCOORD_0','uv',2]]as const){
  const a=g.accessors[primitive.attributes[semantic]],v=g.bufferViews[a.bufferView],offset=(v.byteOffset??0)+(a.byteOffset??0);
  geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(Uint8Array.from(bin.subarray(offset,offset+a.count*width*4)).buffer),width));
 }
 const a=g.accessors[primitive.indices],v=g.bufferViews[a.bufferView],offset=(v.byteOffset??0)+(a.byteOffset??0),indices:number[]=[];
 for(let i=0;i<a.count;i++)indices.push(a.componentType===5125?bin.readUInt32LE(offset+i*4):bin.readUInt16LE(offset+i*2));
 geometry.setIndex(indices);return geometry;
}
for(const id of ['tree-broadleaf','tree-pine'])test(`${id} shadow/distant geometry reduces real shipped meshes and preserves visible source`,()=>{
 const source=shippedTree(id),before=JSON.stringify(source.toJSON()),shadow=treeShadowGeometry(source),distant=treeDistantGeometry(source,id as 'tree-broadleaf'|'tree-pine');
 for(const reduced of [shadow,distant]){
  assert.ok(reduced.index!.count<source.index!.count*.45);
  assert.ok(reduced.index!.count>60,'the tree must retain a meaningful silhouette');
  for(const attribute of Object.values(reduced.attributes))assert.ok(Array.from(attribute.array).every(Number.isFinite));
  for(const index of reduced.index!.array)assert.ok(index<reduced.attributes.position.count);
 }
 assert.equal(distant.attributes.color.count,distant.attributes.position.count);
 assert.equal(distant.attributes.normal.count,distant.attributes.position.count);
 assert.equal(shadow.attributes.uv,undefined);
 // Clustering may populate source bounds, but never edits its vertex/UV/index data.
 const after=source.toJSON();delete after.data!.boundingSphere;
 const original=JSON.parse(before);delete original.data.boundingSphere;assert.deepEqual(after,original);
});
test('tree detail shares transforms and tint, keeps near geometry, and isolates shadow draws',()=>{
 const source=new THREE.Mesh(shippedTree('tree-broadleaf'),new THREE.MeshStandardMaterial());
 const tree={x:150,y:30,z:-80,size:1.2,kind:'tree-broadleaf' as const};
 const group=createTreeBatches(source,[tree],()=>new THREE.Color('#567845')),lod=group.children[0] as THREE.LOD;
 assert.ok(lod.isLOD);const near=lod.levels[0].object as THREE.InstancedMesh,far=lod.levels[1].object as THREE.InstancedMesh,shadow=lod.children.find(o=>o.name.endsWith('/shadow')) as THREE.InstancedMesh;
 assert.equal(near.geometry,source.geometry);assert.equal((far.material as THREE.MeshStandardMaterial).vertexColors,true);assert.equal(near.instanceMatrix,far.instanceMatrix);assert.equal(near.instanceColor,far.instanceColor);
 assert.equal(shadow.instanceMatrix,near.instanceMatrix);assert.equal(near.castShadow,false);assert.equal(far.castShadow,false);assert.equal(shadow.castShadow,true);
 group.updateMatrixWorld(true);const matrix=new THREE.Matrix4();near.getMatrixAt(0,matrix);matrix.premultiply(near.matrixWorld);const p=new THREE.Vector3().setFromMatrixPosition(matrix);
 assert.ok(p.distanceTo(new THREE.Vector3(tree.x,tree.y,tree.z))<1e-5);
 const camera=new THREE.PerspectiveCamera();camera.position.copy(lod.position).add(new THREE.Vector3(0,0,50));camera.updateMatrixWorld();lod.update(camera);assert.equal(near.visible,true);assert.equal(far.visible,false);
 camera.position.copy(lod.position).add(new THREE.Vector3(0,0,130));camera.updateMatrixWorld();lod.update(camera);assert.equal(far.visible,true);
 camera.position.copy(lod.position).add(new THREE.Vector3(0,0,105));camera.updateMatrixWorld();lod.update(camera);assert.equal(far.visible,true,'hysteresis keeps a stable level near the threshold');
 camera.position.copy(lod.position).add(new THREE.Vector3(0,0,80));camera.updateMatrixWorld();lod.update(camera);assert.equal(near.visible,true);assert.equal(shadow.visible,true);
 (shadow.onBeforeShadow as Function)();assert.equal(shadow.geometry.drawRange.count,Infinity);
 (shadow.onAfterShadow as Function)();assert.equal(shadow.geometry.drawRange.count,0);
 (shadow.onBeforeRender as Function)();assert.equal(shadow.geometry.drawRange.count,0);
 assert.equal((shadow.material as THREE.Material).colorWrite,false);assert.equal((shadow.material as THREE.Material).depthWrite,false);
});
test('invalid clustering settings are rejected',()=>{
 for(const cells of [0,1,100,NaN,3.5])assert.throws(()=>treeShadowGeometry(new THREE.BoxGeometry(),cells),RangeError);
});

test('distant tree proxies keep a bounded continuous silhouette and stable colors',()=>{
 for(const kind of ['tree-broadleaf','tree-pine']as const){
  const source=shippedTree(kind),far=treeDistantGeometry(source,kind);source.computeBoundingBox();far.computeBoundingBox();
  const original=source.boundingBox!,box=far.boundingBox!,height=original.max.y-original.min.y;
  assert.ok(Math.abs(box.min.y-original.min.y)<height*.01);assert.ok(Math.abs(box.max.y-original.max.y)<height*.05);
  const colors=far.attributes.color;const unique=new Set(Array.from({length:colors.count},(_,i)=>[colors.getX(i),colors.getY(i),colors.getZ(i)].join(',')));
  assert.equal(unique.size,2,'only stable trunk/canopy colors, with no source atlas patchwork');
 }
});
