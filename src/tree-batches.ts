import * as THREE from 'three';
import type {TreePlacement} from './tree-layout';
/** Spatial batches let the normal camera/shadow frustums reject distant woodland.
 * Every tree keeps its original geometry, material, position, rotation and tint. */
export function createTreeBatches(source:THREE.Mesh,trees:readonly TreePlacement[],tint?:(tree:TreePlacement)=>THREE.Color,cellSize=32){
 const cells=new Map<string,{tree:TreePlacement;index:number}[]>();
 trees.forEach((tree,index)=>{const key=`${Math.floor(tree.x/cellSize)},${Math.floor(tree.z/cellSize)}`;const cell=cells.get(key)??[];cell.push({tree,index});cells.set(key,cell);});
 const group=new THREE.Group(),dummy=new THREE.Object3D();group.name=`generated-${trees[0]?.kind??'trees'}-instances`;
 for(const [key,cell]of cells){
  const batch=new THREE.InstancedMesh(source.geometry,source.material,cell.length);batch.name=`${group.name}/${key}`;batch.castShadow=true;batch.receiveShadow=true;
  for(const [slot,{tree,index}]of cell.entries()){
   dummy.position.set(tree.x,tree.y,tree.z);dummy.scale.setScalar(tree.size);dummy.rotation.y=index*2.399;dummy.updateMatrix();batch.setMatrixAt(slot,dummy.matrix);
   if(tint)batch.setColorAt(slot,tint(tree));
  }
  batch.computeBoundingSphere();group.add(batch);
 }
 return group;
}
