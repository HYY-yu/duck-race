import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {duckScarf} from '../src/duck-scarf';
import {GeneratedAssets} from '../src/generated-assets';

test('scarf has finite geometry and short chest points clear of both wings',()=>{
 const scarf=duckScarf(),bounds=new THREE.Box3().setFromObject(scarf);
 for(const mesh of scarf.children.slice(2)){
  const tailBounds=new THREE.Box3().setFromObject(mesh);
  assert.ok(tailBounds.min.x>-.4&&tailBounds.max.x<.4,'cloth points stay in the centre of the chest');
  assert.ok(tailBounds.min.z>.75&&tailBounds.max.z<1.07,'cloth follows the rounded chest instead of hanging forward');
 }
 const knotBounds=new THREE.Box3().setFromObject(scarf.getObjectByName('scarf-knot')!);
 assert.ok(knotBounds.max.y<1&&knotBounds.max.z<.88,'knot stays below and behind the bill');
 assert.ok(bounds.min.y>.35&&bounds.max.y<1.7,'scarf stays below the face and above the waterline');
 scarf.traverse(object=>{if(object instanceof THREE.Mesh){
  for(const name of ['position','normal']){
   const attribute:THREE.BufferAttribute=object.geometry.getAttribute(name);
   assert.ok(Array.from(attribute.array).every(Number.isFinite),`${object.name}: finite ${name}`);
  }
 }});
 const second=duckScarf();assert.notEqual(second,scarf);
 scarf.children.forEach((mesh,i)=>assert.equal((mesh as THREE.Mesh).geometry,(second.children[i] as THREE.Mesh).geometry));
});

test('scarf assignment works without the incomplete generated accessory and preserves other ducks',()=>{
 class FixtureAssets extends GeneratedAssets {
  override make(){return new THREE.Mesh(new THREE.SphereGeometry(1),new THREE.MeshStandardMaterial());}
 }
 const assets=new FixtureAssets();
 assert.ok(assets.duck('#96bd76',4).getObjectByName('duck-scarf'));
 assert.ok(assets.duck('#96bd76',9).getObjectByName('duck-scarf'));
 assert.equal(assets.duck('#96bd76',0).getObjectByName('duck-scarf'),undefined);
});
