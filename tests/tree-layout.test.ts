import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {IslandTerrain} from '../src/island-terrain';
import {selectTreePlacements,treeRadius,treeReservations,TREE_GAP,TREE_DIMENSIONS,type TreePlacement} from '../src/tree-layout';

test('tree crowns clear each other, the river and scene reservations deterministically',()=>{
 const field=new IslandTerrain();let seed=12;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const candidates:TreePlacement[]=Array.from({length:1200},(_,i)=>{const x=(random()-.5)*80,z=(random()-.5)*92-2;return {x,y:field.height(x,z),z,size:.65+random()*.7,kind:i%4===0?'tree-broadleaf':'tree-pine'};});
 const before=JSON.stringify(candidates),layout=selectTreePlacements(candidates,field);assert.deepEqual(selectTreePlacements(candidates,field),layout);assert.equal(JSON.stringify(candidates),before);assert.ok(layout.trees.length>12,'forest should retain useful coverage');
 for(const [i,t]of layout.trees.entries()){
  const near=field.nearest(t.x,t.z);assert.ok(near.distance>=near.p.width+treeRadius(t)+.9);assert.ok(field.slope(t.x,t.z)<=1.35);
  for(const reserve of treeReservations())assert.ok(Math.hypot(t.x-reserve.x,t.z-reserve.z)>=treeRadius(t)+reserve.radius);
  for(const other of layout.trees.slice(i+1))assert.ok(Math.hypot(t.x-other.x,t.z-other.z)>=treeRadius(t)+treeRadius(other)+TREE_GAP);
 }
 assert.equal(layout.trees.length+Object.values(layout.rejected).reduce((a,b)=>a+b,0),candidates.length);
});

test('placement radii enclose the actual shipped tree geometry at its displayed height',()=>{
 for(const kind of ['tree-broadleaf','tree-pine'] as const){
  const b=readFileSync(new URL(`../public/models/${kind}.glb`,import.meta.url)),length=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+length).toString()),p=g.accessors[g.meshes[0].primitives[0].attributes.POSITION],v=g.bufferViews[p.bufferView],scale=TREE_DIMENSIONS[kind].height/(p.max[1]-p.min[1]),cx=(p.max[0]+p.min[0])/2,cz=(p.max[2]+p.min[2])/2;
  for(let i=0;i<p.count;i++){const offset=28+length+(v.byteOffset??0)+(p.byteOffset??0)+i*12;assert.ok(Math.hypot(b.readFloatLE(offset)-cx,b.readFloatLE(offset+8)-cz)*scale<=TREE_DIMENSIONS[kind].radius,kind);}
 }
});

test('canopies on rising terrain and exposed roots are rejected',()=>{
 const tree:TreePlacement={x:100,y:10,z:100,size:1,kind:'tree-broadleaf'};
 const field={nearest:()=>({distance:100,p:{width:4}}),slope:()=>0,height:(x:number,z:number)=>Math.hypot(x-100,z-100)<1?10:14};
 assert.equal(selectTreePlacements([tree],field).rejected.slope,1);
 assert.equal(selectTreePlacements([tree],{...field,height:()=>11}).rejected.slope,1);
});
