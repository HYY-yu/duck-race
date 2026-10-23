import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {duckScarf} from './duck-scarf';
import {trackEvent} from './observability';

export const MODEL_IDS=['duck','tree-broadleaf','tree-pine','bird','pirate-hat','knight-helmet','glasses','scarf','audience-white-rabbit','audience-bear','audience-fox','audience-gray-rabbit','rabbit'] as const;
export type ModelId=typeof MODEL_IDS[number];
export const ACCESSORIES=['pirate-hat','knight-helmet','glasses','scarf'] as const;
type Shape={height?:number;width?:number;center?:boolean};
/** Shared immutable geometry/textures; instance-specific transforms and duck palettes.
 * Metrics hook: model load duration, bytes, failures and GPU memory by asset ID. */
export class GeneratedAssets {
 private templates=new Map<ModelId,THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>>();
 private geometryCache=new Map<string,THREE.BufferGeometry>();
 private duckMaterials=new Map<string,THREE.MeshStandardMaterial>();
 private pending=new Map<ModelId,Promise<void>>();
 readonly diagnostics:{requested:ModelId[];loaded:ModelId[];failed:ModelId[];attachmentFailed:ModelId[];milliseconds:number;modelMs:Partial<Record<ModelId,number>>}={requested:[],loaded:[],failed:[],attachmentFailed:[],milliseconds:0,modelMs:{}};
 constructor(private readonly loadModel:(id:ModelId)=>Promise<GLTF>=(id)=>new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${id}.glb`)){}
 /** Explicit subsets support scene streaming; shared in-flight requests are reused.
  * The full-library default is retained for the offline asset inspection page. */
 async load(ids:readonly ModelId[]=MODEL_IDS){
  const unique=[...new Set(ids)];
  for(let i=0;i<unique.length;i+=2)await Promise.all(unique.slice(i,i+2).map(id=>this.loadOne(id)));
 }
 private loadOne(id:ModelId):Promise<void>{
  if(this.has(id))return Promise.resolve();
  const existing=this.pending.get(id);if(existing)return existing;
  if(!this.diagnostics.requested.includes(id))this.diagnostics.requested.push(id);
  const start=performance.now();
  const task=Promise.resolve().then(async()=>{
   const gltf=await this.loadModel(id);let template:THREE.Mesh|undefined;
   gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh&&!template)template=o;});
   if(!template)throw new Error(`Model ${id} contains no mesh`);
   const geometry=template.geometry.clone().applyMatrix4(template.matrixWorld),material=(Array.isArray(template.material)?template.material[0]:template.material).clone() as THREE.MeshStandardMaterial;
   if(!geometry.attributes.normal)geometry.computeVertexNormals();material.flatShading=false;
   const mesh=new THREE.Mesh(geometry,material);mesh.name=`generated-${id}`;mesh.castShadow=true;mesh.receiveShadow=true;
   this.templates.set(id,mesh);this.diagnostics.loaded.push(id);console.debug('[assets] model loaded',{id,vertices:geometry.attributes.position.count});
   this.diagnostics.failed=this.diagnostics.failed.filter(failed=>failed!==id);
  }).catch(error=>{
   if(!this.diagnostics.failed.includes(id))this.diagnostics.failed.push(id);
   console.warn('[assets] model load failed; procedural fallback retained',{id,error});trackEvent('asset_failed',{asset:id});
  }).finally(()=>{
   this.diagnostics.modelMs[id]=Math.round(performance.now()-start);this.pending.delete(id);
  });
  this.pending.set(id,task);return task;
 }
 has(id:ModelId){return this.templates.has(id);}
 make(id:ModelId,shape:Shape={height:1}){
  const template=this.templates.get(id);if(!template)throw new Error(`Model unavailable: ${id}`);
  const key=JSON.stringify([id,shape]);let geometry=this.geometryCache.get(key);
  if(!geometry){geometry=template.geometry.clone();geometry.computeBoundingBox();const box=geometry.boundingBox!,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=shape.width?shape.width/size.x:(shape.height??1)/size.y;
   geometry.translate(-center.x,shape.center?-center.y:-box.min.y,-center.z);geometry.scale(scale,scale,scale);this.geometryCache.set(key,geometry);}
  const mesh=new THREE.Mesh(geometry,template.material);mesh.name=`generated-${id}`;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
 }
 duck(color:string,index:number){
  const root=new THREE.Group(),mesh=this.make('duck',{height:1.9});root.name=`generated-duck-${index}`;
  let material=this.duckMaterials.get(color);
  if(!material){material=mesh.material.clone();const map=material.map;
   if(map){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Duck palette canvas unavailable');ctx.drawImage(map.image,0,0,512,512);const pixels=ctx.getImageData(0,0,512,512),target=new THREE.Color(color);const rgb=[target.r,target.g,target.b].map(v=>THREE.ColorManagement.workingToColorSpace(new THREE.Color(v,v,v),THREE.SRGBColorSpace).r*255);
    for(let p=0;p<pixels.data.length;p+=4){const [r,g,b]=pixels.data.subarray(p,p+3);if(r>160&&g/r>.67&&b<r*.58){const shade=.9+.1*r/255;for(let k=0;k<3;k++)pixels.data[p+k]=Math.round(rgb[k]*shade);}}
    ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=map.flipY;material.map=texture;}
   this.duckMaterials.set(color,material);
  }
  mesh.material=material;root.add(mesh);
  // Stable cosmetic assignment, independent of race seed and simulation state.
  const accessory=ACCESSORIES[index%5-1];
  if(accessory==='scarf')root.add(duckScarf());
  else if(accessory&&this.has(accessory)){
   const prop=this.make(accessory,{width:accessory==='pirate-hat'?1.6:accessory==='knight-helmet'?1.3:1.12,center:true});
   prop.position.set(0,accessory==='pirate-hat'?1.92:accessory==='knight-helmet'?1.82:1.45,accessory==='glasses'?.64:.38);root.add(prop);
  }
  return root;
 }
 /** Simple weighted skinning keeps the generated mesh connected while preserving
  * the existing render-only audience/bird animation controls. No physics changes. */
 rig(id:ModelId,shape:Shape,pivots:THREE.Vector3[],weights:(p:THREE.Vector3)=>number[]){
  const source=this.make(id,shape),geometry=source.geometry.clone(),skinIndices:number[]=[],skinWeights:number[]=[],position=new THREE.Vector3();
  for(let i=0;i<geometry.attributes.position.count;i++){position.fromBufferAttribute(geometry.attributes.position,i);const w=weights(position);skinIndices.push(0,1,2,3);skinWeights.push(...w);}
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));
  const bones=[new THREE.Bone(),...pivots.map(p=>{const b=new THREE.Bone();b.position.copy(p);return b;})];for(const b of bones.slice(1))bones[0].add(b);
  while(bones.length<4){const b=new THREE.Bone();bones[0].add(b);bones.push(b);}
  const mesh=new THREE.SkinnedMesh(geometry,source.material);mesh.name=`generated-${id}-rig`;mesh.add(bones[0]);mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;return {mesh,bones};
 }
 bird(){
  const root=new THREE.Group(),{mesh,bones}=this.rig('bird',{width:1.5,center:true},[new THREE.Vector3(-.16,0,0),new THREE.Vector3(.16,0,0)],p=>{const w=THREE.MathUtils.smoothstep(Math.abs(p.x),.15,.38);return [1-w,p.x<0?w:0,p.x>=0?w:0,0];});root.add(mesh);root.userData={left:bones[1],right:bones[2]};return root;
 }
}
