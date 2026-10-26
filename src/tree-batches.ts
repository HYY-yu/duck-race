import * as THREE from 'three';
import {treeShadowGeometry,treeDistantGeometry} from './tree-geometry';
import type {TreePlacement} from './tree-layout';
/** Spatial batches let the normal camera/shadow frustums reject distant woodland.
 * Every nearby tree keeps its original geometry; all retain position, rotation and tint. Far trees use smooth canopy/trunk silhouettes with approximate colors. */
export function createTreeBatches(source:THREE.Mesh,trees:readonly TreePlacement[],tint?:(tree:TreePlacement)=>THREE.Color,cellSize=32){
 // Full-resolution tree meshes can contain ~10k triangles each. Their depth pass
 // needs only the silhouette; sharing one proxy avoids repeating millions of faces.
 const triangles=(source.geometry.index?.count??source.geometry.attributes.position.count)/3;
 const shadowGeometry=triangles>1500?treeShadowGeometry(source.geometry):null;
 const distantGeometry=shadowGeometry?treeDistantGeometry(source.geometry,trees[0]?.kind??'tree-pine'):null;
 const originalMaterial=Array.isArray(source.material)?source.material[0]:source.material;
 const distantMaterial=shadowGeometry?new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}):originalMaterial;
 const shadowMaterial=shadowGeometry?new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}):null;
 const cells=new Map<string,{tree:TreePlacement;index:number}[]>();
 trees.forEach((tree,index)=>{const key=`${Math.floor(tree.x/cellSize)},${Math.floor(tree.z/cellSize)}`;const cell=cells.get(key)??[];cell.push({tree,index});cells.set(key,cell);});
 const group=new THREE.Group(),dummy=new THREE.Object3D();group.name=`generated-${trees[0]?.kind??'trees'}-instances`;
 for(const [key,cell]of cells){
  const batch=new THREE.InstancedMesh(source.geometry,source.material,cell.length);batch.name=`${group.name}/${key}`;batch.castShadow=true;batch.receiveShadow=true;
  for(const [slot,{tree,index}]of cell.entries()){
   dummy.position.set(tree.x,tree.y,tree.z);dummy.scale.setScalar(tree.size);dummy.rotation.y=index*2.399;dummy.updateMatrix();batch.setMatrixAt(slot,dummy.matrix);
   if(tint)batch.setColorAt(slot,tint(tree));
  }
  batch.computeBoundingSphere();
  if(shadowGeometry&&shadowMaterial){
   batch.castShadow=false;
   const shadow=new THREE.InstancedMesh(shadowGeometry,shadowMaterial,cell.length);
   shadow.name=`${batch.name}/shadow`;shadow.castShadow=true;shadow.receiveShadow=false;
   shadow.instanceMatrix=batch.instanceMatrix;shadow.boundingSphere=batch.boundingSphere!.clone();
   // A shadow-only proxy must submit zero triangles in both color passes
   // (including water transmission). Restore its shared draw range for depth.
   shadow.onBeforeRender=()=>shadowGeometry.setDrawRange(0,0);
   shadow.onBeforeShadow=()=>shadowGeometry.setDrawRange(0,Infinity);
   shadow.onAfterShadow=()=>shadowGeometry.setDrawRange(0,0);
   // Put the LOD pivot at the cell centre while keeping both instance transforms
   // in their existing world frame. Hysteresis avoids detail flicker at the boundary.
   const lod=new THREE.LOD(),center=batch.boundingSphere!.center;lod.name=`${batch.name}/detail`;
   lod.position.copy(center);batch.position.copy(center).negate();shadow.position.copy(batch.position);
   const distant=new THREE.InstancedMesh(distantGeometry!,distantMaterial,cell.length);
   distant.name=`${batch.name}/distant`;distant.instanceMatrix=batch.instanceMatrix;distant.instanceColor=batch.instanceColor;
   distant.position.copy(batch.position);distant.boundingSphere=batch.boundingSphere!.clone();distant.receiveShadow=true;
   lod.addLevel(batch,0);lod.addLevel(distant,110,.15);lod.add(shadow);group.add(lod);
   continue;
  }
  group.add(batch);
 }
 // Metrics hook: compare main-pass and shadow triangle budgets without tree locations.
 if(shadowGeometry)console.debug('[render] tree detail batches ready',{batches:cells.size,trees:trees.length,sourceTriangles:triangles,distantTriangles:distantGeometry!.index!.count/3,shadowTriangles:shadowGeometry.index!.count/3});
 return group;
}
