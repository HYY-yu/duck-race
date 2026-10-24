import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTreeBatches} from '../src/tree-batches';
import type {TreePlacement} from '../src/tree-layout';

test('spatial tree batches preserve every transform, material and per-tree tint',()=>{
 const source=new THREE.Mesh(new THREE.BoxGeometry(2,6,2),new THREE.MeshStandardMaterial());
 const trees:TreePlacement[]=Array.from({length:15},(_,i)=>({x:(i%5-2)*24,y:i*.4,z:Math.floor(i/5)*24,size:.8+i*.02,kind:'tree-pine'}));
 const color=(tree:TreePlacement)=>new THREE.Color().setRGB(.6+tree.y*.01,.8,.7);
 const group=createTreeBatches(source,trees,color),matrix=new THREE.Matrix4(),expected=new THREE.Object3D(),actualColor=new THREE.Color();
 let total=0;
 for(const object of group.children){
  const batch=object as THREE.InstancedMesh;assert.equal(batch.geometry,source.geometry);assert.equal(batch.material,source.material);assert.equal(batch.castShadow,true);assert.equal(batch.receiveShadow,true);
  assert.ok(batch.boundingSphere);
  for(let slot=0;slot<batch.count;slot++){
   batch.getMatrixAt(slot,matrix);const position=new THREE.Vector3().setFromMatrixPosition(matrix),index=trees.findIndex(t=>Math.abs(t.x-position.x)<1e-5&&Math.abs(t.y-position.y)<1e-5&&Math.abs(t.z-position.z)<1e-5);assert.ok(index>=0);
   const tree=trees[index];expected.position.set(tree.x,tree.y,tree.z);expected.scale.setScalar(tree.size);expected.rotation.y=index*2.399;expected.updateMatrix();
   matrix.elements.forEach((value,i)=>assert.ok(Math.abs(value-expected.matrix.elements[i])<1e-5));
   batch.getColorAt(slot,actualColor);const tint=color(tree);assert.ok(Math.abs(actualColor.r-tint.r)<1e-6);assert.ok(Math.abs(actualColor.g-tint.g)<1e-6);assert.ok(Math.abs(actualColor.b-tint.b)<1e-6);
   total++;
  }
 }
 assert.equal(total,trees.length);assert.ok(group.children.length>1);
});

test('tree chunks allow off-camera geometry to be culled without removing visible trees',()=>{
 const source=new THREE.Mesh(new THREE.BoxGeometry(2,6,2),new THREE.MeshStandardMaterial()),trees:TreePlacement[]=[{x:0,y:0,z:0,size:1,kind:'tree-pine'},{x:100,y:0,z:0,size:1,kind:'tree-pine'}];
 const group=createTreeBatches(source,trees),camera=new THREE.PerspectiveCamera(50,1,.1,50);camera.position.set(0,4,15);camera.lookAt(0,3,0);camera.updateMatrixWorld();
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));group.updateMatrixWorld(true);
 assert.equal(frustum.intersectsObject(group.children[0] as THREE.InstancedMesh),true);
 assert.equal(frustum.intersectsObject(group.children[1] as THREE.InstancedMesh),false);
});
