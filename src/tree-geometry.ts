import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {TreeKind} from './tree-layout';
/** Spatial vertex clustering is sufficient for a tree's small shadow-map footprint.
 * Keep the visible GLB untouched. No UVs/textures are needed in this depth-only mesh. */
export function treeShadowGeometry(source:THREE.BufferGeometry,cells=10){
 if(!Number.isInteger(cells)||cells<2||cells>64)throw new RangeError('Tree clustering cells must be an integer from 2 to 64');
 source.computeBoundingBox();const box=source.boundingBox!,size=box.getSize(new THREE.Vector3());
 const position=source.attributes.position,clusters=new Map<string,number>(),remap:number[]=[],sums:number[][]=[];
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  const key=[Math.floor((x-box.min.x)/Math.max(size.x,1e-6)*cells),Math.floor((y-box.min.y)/Math.max(size.y,1e-6)*cells),Math.floor((z-box.min.z)/Math.max(size.z,1e-6)*cells)].join(',');
  let slot=clusters.get(key);if(slot===undefined){slot=sums.length;clusters.set(key,slot);sums.push([0,0,0,0]);}
  const sum=sums[slot];sum[0]+=x;sum[1]+=y;sum[2]+=z;sum[3]++;remap.push(slot);
 }
 const vertices=sums.flatMap(([x,y,z,n])=>[x/n,y/n,z/n]),indices:number[]=[],faces=new Set<string>(),index=source.index;
 for(let i=0;i<(index?.count??position.count);i+=3){
  const a=remap[index?index.getX(i):i],b=remap[index?index.getX(i+1):i+1],c=remap[index?index.getX(i+2):i+2];
  if(a===b||a===c||b===c)continue;
  const key=[a,b,c].sort((x,y)=>x-y).join(',');if(faces.has(key))continue;faces.add(key);indices.push(a,b,c);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
/** Smooth distant silhouettes avoid folding the source mesh or mixing UV islands.
 * Near trees use the original GLB; the far proxy approximates canopy/trunk colors. */
export function treeDistantGeometry(source:THREE.BufferGeometry,kind:TreeKind){
 source.computeBoundingBox();const bounds=source.boundingBox!,size=bounds.getSize(new THREE.Vector3()),parts:THREE.BufferGeometry[]=[];
 const add=(g:THREE.BufferGeometry,color:string,scale:number[],position:number[])=>{
  g.scale(scale[0],scale[1],scale[2]);g.translate(position[0],position[1]+bounds.min.y,position[2]);
  const c=new THREE.Color(color),colors=Array.from({length:g.attributes.position.count},()=>[c.r,c.g,c.b]).flat();
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));parts.push(g);
 };
 add(new THREE.CylinderGeometry(1,1,1,8),'#976c48',[size.x*.045,size.y*.52,size.z*.045],[0,size.y*.26,0]);
 if(kind==='tree-pine'){
  for(const [r,h,y]of [[.48,.34,.46],[.39,.32,.64],[.28,.37,.815]])add(new THREE.ConeGeometry(1,1,12),'#387b50',[size.x*r,size.y*h,size.z*r],[0,size.y*y,0]);
 }else{
  for(const [x,y,rx,ry,rz]of [[-.18,.65,.31,.29,.42],[.2,.67,.30,.27,.4],[0,.81,.30,.19,.37]])add(new THREE.SphereGeometry(1,12,8),'#73a944',[size.x*rx,size.y*ry,size.z*rz],[size.x*x,size.y*y,0]);
 }
 const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();
 if(!geometry)throw new Error('Distant tree geometry could not be merged');
 geometry.computeBoundingSphere();return geometry;
}
