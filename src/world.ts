import {WHEEL} from './wheel-collision';
import {createTreeBatches} from './tree-batches';
import {alpineBiome,alpineTreeCandidates,rockExposure} from './alpine-biome';
import {addAlpineAtmosphere} from './alpine-atmosphere';
import * as THREE from 'three';
import {addLongCourseProps} from './course-props';
import {TRAFFIC_CONE_S} from './traffic-cone';
import {sample,world,TRACK_LENGTH,LAKE_LEVEL,obstacles,inFall,COURSE_SCALE,LONG_COURSE,SLIDE,MOUNTAIN_COURSE,TRACK_SEED,bankWidth,bankDistance,blockers} from './track';
import {WaterSystem,captureWaterEnvironment} from './water';
import {ImpactEffects} from './impact-effects';
import {waterWave} from './water-wave';
import {COLORS,type Race} from './simulation';
import {IslandTerrain,terrainNoise} from './island-terrain';
import {BridgeAudience} from './bridge-audience';
import {ACCESSORIES,GeneratedAssets,type ModelId} from './generated-assets';
import {loadSceneAssets,type AssetStage} from './asset-loading';
import {selectTreePlacements,treeRadius,TREE_DIMENSIONS,type TreePlacement} from './tree-layout';
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const mat=(color:THREE.ColorRepresentation,roughness=.82)=>new THREE.MeshStandardMaterial({color,roughness});
const grass=mat('#92b88a'),wood=mat('#976c48'),ivory=mat('#fff9e7'),dark=mat('#263d3a'),orange=mat('#f2a04c');
const sphere=new THREE.SphereGeometry(1,20,14);
/** Angular, flat-topped slab for bedded outcrops. A low-poly polyhedron has round
 * silhouette edges; real exposed bedding has straight fracture planes and sharp rims. */
const slabGeometry=(()=>{
 const g=new THREE.BoxGeometry(1,1,1,1,1,1),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  // Break the box out of axis alignment so no two slabs share a silhouette.
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  p.setXYZ(i,x+(y>0?.06:-.05)*Math.sin(i*2.1),y+(z>0?.08:-.06),z+(x>0?.07:-.05)*Math.cos(i*1.7));
 }
 g.computeVertexNormals();return g;
})();
/** Irregular boulder: a subdivided icosahedron with deterministic vertex jitter, so
 * instances read as broken rock rather than as a faceted ball. */
const blockGeometry=(()=>{
 const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position,done=new Map<string,[number,number,number]>();
 for(let i=0;i<p.count;i++){
  const key=`${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  let v=done.get(key);
  if(!v){
   const seed=Math.sin(p.getX(i)*12.9+p.getY(i)*78.2+p.getZ(i)*37.7)*43758.5453;
   const n=seed-Math.floor(seed),m=seed*1.7-Math.floor(seed*1.7);
   v=[1+(n-.5)*.34,1+(m-.5)*.30,1+(n+m-1)*.28];done.set(key,v);
  }
  p.setXYZ(i,p.getX(i)*v[0],p.getY(i)*v[1],p.getZ(i)*v[2]);
 }
 g.computeVertexNormals();return g;
})();
function mesh(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Vector3|number[]=[0,0,0],scale?:number[]){const o=new THREE.Mesh(g,m);o.position.fromArray(Array.isArray(p)?p:p.toArray());if(scale)o.scale.fromArray(scale);o.castShadow=true;o.receiveShadow=true;return o;}
function ball(parent:THREE.Object3D,m:THREE.Material,p:number[],scale:number[]){const o=mesh(sphere,m,p,scale);parent.add(o);return o;}
function box(parent:THREE.Object3D,m:THREE.Material,p:number[],scale:number[]){const o=mesh(new THREE.BoxGeometry(1,1,1),m,p,scale);parent.add(o);return o;}
function pole(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material){const o=mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),m,a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());parent.add(o);return o;}
function textTexture(text:string,bg='#fff9e7',fg='#2e5550'){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=fg;ctx.fillText(text,256,68);return new THREE.CanvasTexture(c);}
export function duckModel(color:string){const g=new THREE.Group(),m=mat(color,.24),beak=mat('#f49b39',.35);ball(g,m,[0,.65,0],[.78,.61,1.04]);ball(g,m,[0,1.36,.55],[.58,.59,.57]);ball(g,beak,[0,1.22,1.06],[.42,.16,.35]);ball(g,m,[-.64,.72,-.1],[.22,.35,.62]);ball(g,m,[.64,.72,-.1],[.22,.35,.62]);const tail=ball(g,m,[0,.85,-.91],[.34,.35,.45]);tail.rotation.x=-.5;for(const x of [-.47,.47]){ball(g,dark,[x,1.49,.84],[.083,.105,.075]);ball(g,ivory,[x*.99,1.52,.898],[.028,.033,.022]);}return g;}
export class World {
 private frameDummy=new THREE.Object3D();private lastFoamTime=NaN;
 private conePivot=new THREE.Group();private coneAxis=new THREE.Vector3();
 private trafficCone(){
  const p=sample(TRAFFIC_CONE_S),root=new THREE.Group(),pivot=this.conePivot;
  root.name='traffic-cone';root.position.set(p.x,p.y-.08,p.z);root.rotation.y=Math.atan2(p.tx,p.tz);root.add(pivot);
  box(pivot,dark,[0,.09,0],[1.32,.18,1.32]);
  const coneOrange=mat('#fa702e',.48),coneWhite=mat('#fff8e8',.42);
  // Separate tapered bands avoid textures, loading and additional dependencies.
  const height=1.55,bottom=.52,top=.06;
  for(const [a,b,white]of [[0,.3,0],[.3,.46,1],[.46,.65,0],[.65,.79,1],[.79,1,0]]){
   const r=(t:number)=>bottom+(top-bottom)*t;
   pivot.add(mesh(new THREE.CylinderGeometry(r(b),r(a),(b-a)*height,12),white?coneWhite:coneOrange,[0,.18+(a+b)*height/2,0]));
  }
  this.scene.add(root);this.moving.push({kind:'cone',root,part:pivot});
 }
 scene=new THREE.Scene();duckMeshes:THREE.Group[]=[];private duckPool:THREE.Group[]=[];private duckColors:string[]=[...COLORS];water:WaterSystem;effects:ImpactEffects;moving:{kind:string;root:THREE.Group;part:THREE.Group}[]=[];birds:THREE.Group[]=[];rabbits:THREE.Group[]=[];foam:THREE.InstancedMesh;trail:THREE.InstancedMesh;private hitHalos:THREE.InstancedMesh;private springRipples:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>[]=[];private randSeed=MOUNTAIN_COURSE?TRACK_SEED:12;
 private cameraBoxes:THREE.Box3[]=[];private movingCameraBoxes:{mesh:THREE.Mesh;box:THREE.Box3}[]=[];private cameraRay=new THREE.Ray();private cameraDirection=new THREE.Vector3();private cameraHit=new THREE.Vector3();
 readonly generatedAssets=new GeneratedAssets();generatedReady=false;generatedStage:AssetStage|'pending'|'complete'|'degraded'='pending';private treePlacements:TreePlacement[]=[];
 private atmosphere?:ReturnType<typeof addAlpineAtmosphere>;private terrainField=new IslandTerrain();private audience?:BridgeAudience;private reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 random(){this.randSeed=(Math.imul(this.randSeed,1664525)+1013904223)>>>0;return this.randSeed/4294967296;}
 constructor(renderer:THREE.WebGLRenderer){this.scene.background=new THREE.Color(MOUNTAIN_COURSE?'#c6dce5':'#e9eee5');this.scene.fog=new THREE.Fog(MOUNTAIN_COURSE?'#c6dce5':'#e9eee5',155*COURSE_SCALE,290*COURSE_SCALE);this.scene.add(new THREE.HemisphereLight('#fff7df','#718a77',MOUNTAIN_COURSE?1.9:2.65));const sun=new THREE.DirectionalLight('#fff3d9',MOUNTAIN_COURSE?2.7:3.4);sun.position.set(-35,70,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65*COURSE_SCALE,right:65*COURSE_SCALE,top:65*COURSE_SCALE,bottom:-65*COURSE_SCALE,near:1,far:180*COURSE_SCALE});sun.shadow.bias=-.0003;sun.shadow.normalBias=.12;this.scene.add(sun);
 const ground=mesh(new THREE.PlaneGeometry(2000,2000),mat('#e9eee5'),[0,-6,0]);ground.name='background-ground';ground.rotation.x=-Math.PI/2;this.scene.add(ground);
 this.terrain();this.coast();if(MOUNTAIN_COURSE){this.distantMassif();this.atmosphere=addAlpineAtmosphere(this.scene,this.reducedMotion,(x,z)=>this.height(x,z));}
 this.decorate();this.river();const environment=captureWaterEnvironment(renderer,this.scene);
 this.water=new WaterSystem(this.scene,environment.texture);this.effects=new ImpactEffects(this.scene);
 for(const o of obstacles)this.obstacle(o.kind,o.s);this.gate(7,'START');this.gate(TRACK_LENGTH-2,'FINISH');
 this.trafficCone();this.naturalObstacles();
 if(LONG_COURSE)addLongCourseProps(this.scene,this.moving,(x,z)=>this.height(x,z));
 this.foam=new THREE.InstancedMesh(sphere,new THREE.MeshBasicMaterial({color:'#d7eee5',transparent:true,opacity:.42}),230);this.foam.castShadow=false;this.scene.add(this.foam);this.trail=new THREE.InstancedMesh(new THREE.RingGeometry(.3,.37,24,1,0,Math.PI),new THREE.MeshBasicMaterial({color:'#d3fff0',transparent:true,opacity:.26,side:THREE.DoubleSide}),72);this.scene.add(this.trail);
 this.hitHalos=new THREE.InstancedMesh(new THREE.RingGeometry(.85,1.03,40),new THREE.MeshBasicMaterial({color:'#ffe6a6',transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}),12);this.hitHalos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.hitHalos.frustumCulled=false;this.scene.add(this.hitHalos);
 this.spring();
 for(let i=0;i<7;i++){const bird=new THREE.Group();const body=ball(bird,ivory,[0,0,0],[.13,.16,.4]);body.rotation.x=.2;const left=box(bird,ivory,[-.4,0,0],[.8,.065,.22]),right=box(bird,ivory,[.4,0,0],[.8,.065,.22]);bird.userData={left,right};this.birds.push(bird);this.scene.add(bird);}
  this.scene.updateMatrixWorld(true);
  this.scene.traverse(object=>{
   if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||['island-terrain','background-ground','submerged-riverbed'].includes(object.name))return;
   const materials=Array.isArray(object.material)?object.material:[object.material];
   if(materials.some(m=>m.transparent||m instanceof THREE.MeshPhysicalMaterial||m instanceof THREE.MeshBasicMaterial))return;
   let moving=false;for(let parent:THREE.Object3D|null=object;parent;parent=parent.parent){if(this.moving.some(item=>item.root===parent)){moving=true;break;}}
   const box=new THREE.Box3().setFromObject(object).expandByScalar(.35);
   if(moving)this.movingCameraBoxes.push({mesh:object,box});this.cameraBoxes.push(box);
  });
  // Keep the procedural scene playable first; start the duck after the first paint,
  // then yield between optional model batches. Metrics hook: core vs. full-scene latency.
  requestAnimationFrame(()=>requestAnimationFrame(()=>void this.replaceGeneratedModels().catch(error=>{
   this.generatedStage='degraded';console.error('[assets] scene replacement failed',error);
  })));
 }
 async replaceGeneratedModels(){
  const assets=this.generatedAssets;
  await loadSceneAssets(assets,{treeKinds:this.treePlacements.map(p=>p.kind),birds:this.birds.length>0,rabbits:this.rabbits.length>0,audience:!!this.audience},id=>this.attachGeneratedModel(id),stage=>{this.generatedStage=stage;});
  this.generatedReady=assets.diagnostics.failed.length===0&&assets.diagnostics.attachmentFailed.length===0;this.generatedStage=this.generatedReady?'complete':'degraded';
  console.info('[assets] generated scenery attached',{trees:this.treePlacements.length,ducks:this.duckPool.length,birds:this.birds.length,rabbits:this.rabbits.length});
 }
 private attachGeneratedModel(id:ModelId){
  const assets=this.generatedAssets;
  if(id==='duck'||id==='pirate-hat'||id==='knight-helmet'||id==='glasses'){
   if(assets.has('duck'))for(let i=0;i<this.duckPool.length;i++){
    if(id!=='duck'&&id!==ACCESSORIES[i%5-1])continue;
    const root=this.duckPool[i],color=this.duckColors[i]??COLORS[i],model=assets.duck(color,i);root.clear();root.add(model);root.userData.color=color;
   }
  }else if(id==='tree-broadleaf'||id==='tree-pine'){
   const source=assets.make(id,{height:TREE_DIMENSIONS[id].height}),placements=this.treePlacements.filter(p=>p.kind===id);
   const batch=createTreeBatches(source,placements,MOUNTAIN_COURSE?p=>{const tint=terrainNoise(p.x*.11+9,p.z*.11-3);return new THREE.Color().setRGB(.83+tint*.12,.91+tint*.07,.79+tint*.12);}:undefined);
   for(const object of [...this.scene.children])if(object instanceof THREE.InstancedMesh&&object.name===`procedural-${id}`){this.scene.remove(object);object.dispose();object.geometry.dispose();}
   this.scene.add(batch);
  }else if(id==='rabbit')for(const root of this.rabbits){root.clear();root.add(assets.make(id,{height:1.5}));}
  else if(id==='bird')for(const root of this.birds){const bird=assets.bird();root.clear();root.add(...[...bird.children]);root.userData=bird.userData;}
  else if(id.startsWith('audience-'))this.audience?.setGeneratedAssets(assets,[id]);
  console.debug('[assets] model attached',{id});
 }
 spring(){
  const start=sample(0),root=new THREE.Group();root.name='headwater-spring';root.position.set(start.x,start.y,start.z);root.rotation.y=Math.atan2(start.tx,start.tz);
  const stone=mat('#9ba99a'),wetStone=mat('#697e74',.48),moss=mat('#7c9d73');
  for(const [x,y,z,sx,sy,sz]of [[-2.4,.9,-3.6,1.5,1.5,1.6],[2.1,1,-4,1.5,1.8,1.5],[-.9,2.6,-4.6,1.8,1.2,1.3],[1.1,2.9,-4.7,1.4,1.3,1.4],[-3,.2,-1.7,1.1,.7,1.4],[2.7,.2,-1.4,1.2,.65,1.1]]){
   const rock=mesh(new THREE.DodecahedronGeometry(1,1),stone,[x,y,z],[sx,sy,sz]);rock.rotation.set(x*.17,z*.4,y*.12);root.add(rock);
   ball(root,moss,[x-.2,y+sy*.66,z],[sx*.65,.18,sz*.62]);
  }
  ball(root,wetStone,[0,1.4,-4.55],[1.35,1.2,.6]);
  const flowing=(geo:THREE.BufferGeometry)=>{
   const p=geo.attributes.position,n=p.count,uv:number[]=[],data:number[]=[],shore:number[]=[],axes:number[]=[],banks:number[]=[];
   for(let i=0;i<n;i++){const x=p.getX(i),z=p.getZ(i);uv.push((x+2.8)/5.6,z);data.push(1.4,1,.08,5.6);shore.push(1,1,x);axes.push(0,1,-1,0);banks.push(Math.max(0,2.8-Math.abs(x)));}
   for(const [name,values,size]of [['uv',uv,2],['riverData',data,4],['riverShore',shore,3],['riverAxis',axes,4],['riverBankDistance',banks,1],['riverImpact',Array(n).fill(.1),1]] as [string,number[],number][])geo.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
   const water=mesh(geo,this.water.surface);water.castShadow=false;root.add(water);
  };
  const pool=new THREE.CircleGeometry(1,64);pool.rotateX(-Math.PI/2);pool.scale(2.8,1,3.1);pool.translate(0,.035,-1.35);flowing(pool);
  // A thin flowing sheet emerges from the rock seep and joins the starting pool.
  const positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=24;i++)for(let j=0;j<=8;j++){const t=i/24,u=j/8,width=.62+.22*t;positions.push((u*2-1)*width,1.65*(1-t)**1.25+.05,-4.05+t*2.6);if(i<24&&j<8){const a=i*9+j,b=a+9;indices.push(a,b,a+1,a+1,b,b+1);}}
  const sheet=new THREE.BufferGeometry();sheet.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));sheet.setIndex(indices);sheet.computeVertexNormals();flowing(sheet);
  for(let i=0;i<4;i++){
   const ripple=new THREE.Mesh(new THREE.RingGeometry(.7,.75,48),new THREE.MeshBasicMaterial({color:'#e3fff3',transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide}));ripple.rotation.x=-Math.PI/2;ripple.position.set(0,.075+i*.003,-1.4);root.add(ripple);this.springRipples.push(ripple);
  }
  this.scene.add(root);console.info('[world] headwater spring ready',{streams:1,ripples:4});
 }
 get audienceState(){return this.audience?.diagnostics??[];}
 nearest(x:number,z:number){return this.terrainField.nearest(x,z);}
 height(x:number,z:number){return this.terrainField.height(x,z);}
  private distantMassif(){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],cols=110,rows=46,color=new THREE.Color();
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const x=-430+i/cols*860,z=155+j/rows*330;
   const peak=(cx:number,cz:number,h:number,rx:number,rz:number)=>h*Math.pow(Math.max(0,1-Math.hypot((x-cx)/rx,(z-cz)/rz)),1.2);
   const crest=Math.max(peak(-210,295,178,170,145),peak(15,330,226,185,165),peak(245,310,193,170,150));
   const ridges=(terrainNoise(x*.026,z*.026)*16+terrainNoise(x*.09,z*.09)*5)*Math.min(1,crest/35),h=-6+crest+ridges;
   positions.push(x,h,z);color.set(h>140+terrainNoise(x*.04,z*.04)*15?'#dbe8e9':h>70?'#71868a':'#607d76');color.offsetHSL(0,0,terrainNoise(x*.1,z*.1)*.06);colors.push(color.r,color.g,color.b);
   if(i<cols&&j<rows){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mountains=mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));mountains.name='distant-alpine-massif';mountains.castShadow=false;this.scene.add(mountains);

 }
 terrain(){
  const field=this.terrainField,positions:number[]=[],colors:number[]=[],indices:number[]=[],color=new THREE.Color(),rock=new THREE.Color('#a5aaa0');
  for(let j=0;j<=field.rows;j++)for(let i=0;i<=field.cols;i++){
   const x=field.minX+i*field.step,z=field.minZ+j*field.step,h=field.heights[j*(field.cols+1)+i],slope=field.slope(x,z);
   positions.push(x,h,z);
   if(MOUNTAIN_COURSE){
    // Layered alpine ground: meadow -> grass -> scree -> rock -> snow, with the
    // transitions driven by slope and noise so no band reads as a painted stripe.
    const biome=alpineBiome(x,z,h,slope),mass=smooth(18,96,h);
    const exposure=rockExposure(x,z,h,slope,mass);
    const strata=Math.sin((h*.85+terrainNoise(x*.06,z*.06)*3.4)*.9)*.5+.5;
    const scree=Math.max(0,Math.min(1,smooth(52,86,h)*(.25+terrainNoise(x*.13+5,z*.13-2)*.4+.35)));
    color.set('#4e7a45');                                        // sheltered alpine meadow
    color.lerp(new THREE.Color('#6f9558'),.30+biome.patch*.22);   // sunlit grass
    color.lerp(new THREE.Color('#8a9a68'),Math.max(0,scree*.5));  // dry turf above the treeline
    color.lerp(new THREE.Color('#8d8b80'),exposure*.72);          // scree fans and bare faces
    color.lerp(new THREE.Color('#736f65'),exposure*strata*.5);    // bedding shadow in the rock
    color.lerp(new THREE.Color('#5d5a52'),Math.max(0,(slope-1.9)*.42)); // near-vertical faces stay dark
    color.lerp(new THREE.Color('#f2f6fa'),biome.snow);            // snow, last so it caps everything
    if(field.bankDistances[j*(field.cols+1)+i]<3)color.lerp(new THREE.Color('#6d6554'),.30); // wet bank
   }else{
    color.set(h<LAKE_LEVEL-.5?'#8aa99b':h<LAKE_LEVEL+.9?'#d9cfaa':h<LAKE_LEVEL+2.4?'#b7c195':'#91b682');
    const exposure=Math.max(0,Math.min(.75,(slope-.8)*.6))*(h>5?1:0);
    color.lerp(rock,exposure);
   }
   const variation=terrainNoise(x*.18+7,z*.18)*.024;color.offsetHSL(variation*.3,variation,variation);colors.push(color.r,color.g,color.b);
   if(i<field.cols&&j<field.rows){const a=j*(field.cols+1)+i,b=a+field.cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const terrain=mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));terrain.name='island-terrain';this.scene.add(terrain);
  if(MOUNTAIN_COURSE)this.surroundings();
  console.info('[world] terrain ready',{vertices:positions.length/3,smoothingPasses:7});
 }
 /** Ring skirt carrying the valley floor and foothills beyond the baked grid.
  * It is built from the grid's own boundary vertices outward, so the shared edge is
  * vertex-for-vertex identical to the terrain mesh and no seam can appear. */
 private surroundings(){
  const field=this.terrainField,rings=22,maxOut=980;
  const x0=field.minX,x1=field.minX+field.cols*field.step,z0=field.minZ,z1=field.minZ+field.rows*field.step;
  const cx=(x0+x1)/2,cz=(z0+z1)/2;
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const color=new THREE.Color();
  const paint=(x:number,z:number,h:number)=>{
   const slope=field.slope(x,z);
   color.set('#4e7a45').lerp(new THREE.Color('#6f9558'),.26+terrainNoise(x*.02,z*.02)*.16);
   color.lerp(new THREE.Color('#8d8b80'),Math.max(0,Math.min(1,(slope-1.1)*.4)));
   color.lerp(new THREE.Color('#f2f6fa'),smooth(114,152,h)*(1-Math.min(.6,slope*.2)));
   // Shallow water near the shoreline reads as a beach shelf rather than a cut edge.
   color.lerp(new THREE.Color('#5f7c72'),Math.max(0,Math.min(.55,(LAKE_LEVEL-h)*.16)));
   return color;
  };
  // Ring 0 is the terrain boundary itself; the perimeter vertices must match exactly.
  const perimeter:{x:number;z:number;h:number}[]=[];
  for(let i=0;i<=field.cols;i++)perimeter.push({x:x0+i*field.step,z:z0,h:field.heights[i]});
  for(let j=1;j<=field.rows;j++)perimeter.push({x:x1,z:z0+j*field.step,h:field.heights[j*(field.cols+1)+field.cols]});
  for(let i=field.cols-1;i>=0;i--)perimeter.push({x:x0+i*field.step,z:z1,h:field.heights[field.rows*(field.cols+1)+i]});
  for(let j=field.rows-1;j>=1;j--)perimeter.push({x:x0,z:z0+j*field.step,h:field.heights[j*(field.cols+1)]});
  const count=perimeter.length;
  const scale:number[]=[1];
  for(let r=1;r<=rings;r++){
   // Push outward from the centre so the skirt grows without self-intersecting.
   const grow=Math.pow(r/rings,1.55);
   scale.push(1+grow*maxOut/Math.max(x1-cx,z1-cz));
  }
  for(let r=0;r<=rings;r++){
   const s=scale[r];
   for(let i=0;i<count;i++){
    const p=perimeter[i];
    const x=cx+(p.x-cx)*s,z=cz+(p.z-cz)*s;
    // Outer rings use the procedural landscape; the innermost keeps the grid height.
    const h=r===0?p.h:this.height(x,z);
    positions.push(x,h,z);
    paint(x,z,h);colors.push(color.r,color.g,color.b);
   }
   if(r<rings)for(let i=0;i<count;i++){
    const a=r*count+i,b=r*count+(i+1)%count,c=(r+1)*count+i,d=(r+1)*count+(i+1)%count;
    // The perimeter runs clockwise in X/Z; upward faces use the inner edge first.
    indices.push(a,b,c,b,d,c);
   }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const skirt=mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));skirt.name='valley-surroundings';skirt.castShadow=false;skirt.receiveShadow=true;this.scene.add(skirt);
  console.info('[world] valley surroundings ready',{vertices:positions.length/3,rings,perimeter:count});
 }
 coast(){
  // Shoreline boulders: a ring of tumbled, mostly-buried blocks where land meets water.
  // The mountain course has a bounded outwash lake, so the ring follows the lake instead.
  const limit=MOUNTAIN_COURSE?70:88;
  const rocks=new THREE.InstancedMesh(blockGeometry,mat('#9fa49a'),limit),dummy=new THREE.Object3D();
  let count=0;
  if(MOUNTAIN_COURSE){
   for(let i=0;i<2600&&count<limit;i++){
    const x=(this.random()-.5)*760,z=(this.random()-.5)*760,h=this.height(x,z);
    // Only place where the ground sits right at the waterline and nothing blocks the view.
    if(Math.abs(h-LAKE_LEVEL)>.55)continue;
    const near=this.nearest(x,z);if(near.distance<near.p.width+1.4)continue;
    const size=.5+this.random()*1.5;
    dummy.position.set(x,h-size*.36,z);dummy.rotation.set((this.random()-.5)*.6,this.random()*Math.PI*2,(this.random()-.5)*.6);
    dummy.scale.set(size*1.5,size*.62,size*(.9+this.random()*.5));dummy.updateMatrix();rocks.setMatrixAt(count++,dummy.matrix);
   }
  }else{
   for(let i=0;i<limit;i++){
    const angle=i/limit*Math.PI*2+.035*Math.sin(i*2.7),cx=Math.cos(angle),sz=Math.sin(angle);
    let lo=.52,hi=1.2;
    for(let step=0;step<15;step++){const r=(lo+hi)/2;if(this.height(cx*53*COURSE_SCALE*r,sz*65*COURSE_SCALE*r-7*COURSE_SCALE)>LAKE_LEVEL+.2)lo=r;else hi=r;}
    const r=(lo+hi)/2,x=cx*53*COURSE_SCALE*r,z=sz*65*COURSE_SCALE*r-7*COURSE_SCALE,near=this.nearest(x,z);
    if(near.distance<near.p.width+1.8)continue;
    const size=.35+this.random()*.75;dummy.position.set(x,this.height(x,z)-.05,z);dummy.rotation.set(this.random(),this.random()*6,this.random());dummy.scale.set(size*1.5,size*.65,size);dummy.updateMatrix();rocks.setMatrixAt(count++,dummy.matrix);
   }
  }
  rocks.count=count;rocks.receiveShadow=true;rocks.castShadow=true;rocks.name='island-shore-rocks';this.scene.add(rocks);
  console.info('[world] coast ready',{rocks:count,waterLevel:LAKE_LEVEL});
 }
 river(){
 // Rounded stones and pale banks make the channel readable from the overview. Stones
 // are seated on the bank at their own size, never on a fixed offset.
 const limit=MOUNTAIN_COURSE?150:330,rocks=new THREE.InstancedMesh(blockGeometry,mat('#a9ad9c'),limit);const dummy=new THREE.Object3D();let rockCount=0;
 for(let i=0;i<limit;i++){
  const s=(i+(MOUNTAIN_COURSE?this.random()*.65:0))/limit*TRACK_LENGTH;if(LONG_COURSE&&s>SLIDE.start-1&&s<SLIDE.end+1)continue;
  const p=sample(s),side=i%2?1:-1,v=world(s,side*(bankWidth(s,side)+.25+this.random()*.8));
  const size=.5+this.random()*.75,h=this.height(v.x,v.z);
  dummy.position.set(v.x,h-size*.34,v.z);
  dummy.rotation.set((this.random()-.5)*.45,this.random()*Math.PI*2,(this.random()-.5)*.45);
  dummy.scale.set(size*1.5,size*.6,size*(.9+this.random()*.55));dummy.updateMatrix();rocks.setMatrixAt(rockCount++,dummy.matrix);
 }
 rocks.count=rockCount;rocks.castShadow=true;rocks.receiveShadow=true;rocks.name='river-bank-stones';this.scene.add(rocks);console.info('[world] river scenery ready',{rocks:rockCount});
 }
 decorate(){
 const pineTrunks:THREE.Matrix4[]=[],broadleafTrunks:THREE.Matrix4[]=[],crowns:THREE.Matrix4[]=[],rounds:THREE.Matrix4[]=[],candidates:TreePlacement[]=[];const dummy=new THREE.Object3D();
 // Sample clustered forest cover; retain all canopy, river and camera clearances.
 if(MOUNTAIN_COURSE)candidates.push(...alpineTreeCandidates(this.terrainField,()=>this.random()));
 else for(let i=0;i<270;i++){
  const x=(this.random()-.5)*80*COURSE_SCALE,z=(this.random()-.5)*92*COURSE_SCALE-2*COURSE_SCALE,near=this.nearest(x,z),h=this.height(x,z);
  if(near.distance<near.p.width+3||h<LAKE_LEVEL+.65||z>37*COURSE_SCALE)continue;
  if(terrainNoise(x*.09+41,z*.09-12)<-.15&&this.random()>.3)continue;
  if(this.terrainField.slope(x,z)>1.4&&this.random()>.2)continue;
  candidates.push({x,y:h,z,size:.65+this.random()*.7,kind:i%4===0?'tree-broadleaf':'tree-pine'});
 }
 const layout=selectTreePlacements(candidates,this.terrainField,MOUNTAIN_COURSE?{canopySpacing:.78,limit:1600}:{});this.treePlacements=layout.trees;
 console.info('[world] tree layout ready',{count:layout.trees.length,candidates:layout.candidates,rejected:layout.rejected,altitudeBands:{foothill:layout.trees.filter(t=>t.y<40).length,middle:layout.trees.filter(t=>t.y>=40&&t.y<75).length,upper:layout.trees.filter(t=>t.y>=75).length}});
 for(const tree of this.treePlacements){
  const {x,y:h,z,size,kind}=tree,radius=treeRadius(tree),height=TREE_DIMENSIONS[kind].height*size;
  this.cameraBoxes.push(new THREE.Box3(new THREE.Vector3(x-radius,h+.9*size,z-radius),new THREE.Vector3(x+radius,h+height+.2,z+radius)));
  dummy.position.set(x,h+1.3*size,z);dummy.scale.set(.22*size,2.6*size,.22*size);dummy.rotation.set(0,0,0);dummy.updateMatrix();(kind==='tree-pine'?pineTrunks:broadleafTrunks).push(dummy.matrix.clone());
  if(kind==='tree-broadleaf'){dummy.position.y=h+3.4*size;dummy.scale.set(1.7*size,2.3*size,1.7*size);dummy.updateMatrix();rounds.push(dummy.matrix.clone());}
  else for(let k=0;k<3;k++){dummy.position.y=h+(2.4+k*1.25)*size;dummy.scale.set((2-k*.37)*size,(3.3-k*.35)*size,(2-k*.37)*size);dummy.rotation.y=x+z;dummy.updateMatrix();crowns.push(dummy.matrix.clone());}
 }
 const batches:[string,THREE.BufferGeometry,THREE.Material,THREE.Matrix4[]][]=[['tree-pine',new THREE.CylinderGeometry(1,1,1,6),wood,pineTrunks],['tree-broadleaf',new THREE.CylinderGeometry(1,1,1,6),wood,broadleafTrunks],['tree-pine',new THREE.ConeGeometry(1,1,7),mat('#427e69'),crowns],['tree-broadleaf',new THREE.IcosahedronGeometry(1,1),mat('#7fa665'),rounds]];
 for(const [kind,geo,m,arr]of batches){const o=new THREE.InstancedMesh(geo,m,arr.length);o.name=`procedural-${kind}`;arr.forEach((matrix,i)=>o.setMatrixAt(i,matrix));o.castShadow=true;o.receiveShadow=true;this.scene.add(o);}
 if(MOUNTAIN_COURSE)this.understory();

 for(let i=0;i<(MOUNTAIN_COURSE?9:28);i++){const s=this.random()*TRACK_LENGTH,p=sample(s),v=world(s,p.width+2+this.random()*2);const r=mesh(new THREE.DodecahedronGeometry(1,0),mat(i%3?'#b3baa5':'#d2cdb5'),[v.x,this.height(v.x,v.z)+.2,v.z],[1+this.random(),.8+this.random(),1.1]);this.scene.add(r);}
 for(const s of [28,105,185]){const p=sample(s),v=world(s,p.width+3);const rabbit=new THREE.Group();const m=mat('#f6eed9');ball(rabbit,m,[0,.4,0],[.43,.43,.65]);ball(rabbit,m,[0,.75,.44],[.32,.34,.31]);for(const x of [-.15,.15]){ball(rabbit,m,[x,1.18,.42],[.11,.42,.12]);ball(rabbit,mat('#dfa69a'),[x,1.2,.52],[.052,.27,.025]);ball(rabbit,dark,[x*1.5,.8,.65],[.04,.05,.04]);}ball(rabbit,ivory,[0,.5,-.62],[.2,.2,.2]);rabbit.position.set(v.x,this.height(v.x,v.z)+.2,v.z);rabbit.rotation.y=s;rabbit.userData.base=rabbit.position.clone();this.rabbits.push(rabbit);this.scene.add(rabbit);}
 // Footbridge beside the lake.
 const bridge=new THREE.Group();bridge.position.set(-COURSE_SCALE,3.4,40*COURSE_SCALE);bridge.rotation.y=-.3;if(MOUNTAIN_COURSE){const end=sample(TRACK_LENGTH-4),p=world(TRACK_LENGTH-4,-bankWidth(TRACK_LENGTH-4,-1)-2.2);bridge.position.set(p.x,end.y+1.3,p.z);bridge.rotation.y=Math.atan2(end.tx,end.tz);}for(let i=0;i<12;i++)box(bridge,wood,[(i-5.5)*.6,0,0],[.54,.2,3]);for(const z of [-1.6,1.6]){pole(bridge,new THREE.Vector3(-3.7,1.3,z),new THREE.Vector3(3.7,1.3,z),.09,wood);for(const x of [-3.4,0,3.4])box(bridge,wood,[x,.65,z],[.15,1.5,.15]);}this.scene.add(bridge);this.audience=new BridgeAudience(bridge);
 }
 private understory(){
  // Low shrubs follow the same woodland patches and terrain as the canopy.
  // One instanced batch adds varied undergrowth without one draw call per plant.
  const shrubs=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mat('#75915b'),600),dummy=new THREE.Object3D();let count=0;
  for(let i=0;i<10000&&count<600;i++){
   const field=this.terrainField,x=field.minX+this.random()*field.cols*field.step,z=field.minZ+this.random()*field.rows*field.step,h=this.height(x,z),slope=field.slope(x,z),near=this.nearest(x,z);
   if(h<LAKE_LEVEL+2||h>83||slope>.85||near.distance<near.p.width+3||alpineBiome(x,z,h,slope).forest<.48)continue;
   const size=.45+this.random()*.6;
   dummy.position.set(x,h+size*.26,z);dummy.rotation.set(0,this.random()*Math.PI*2,0);dummy.scale.set(size,size*.55,size*.8);dummy.updateMatrix();shrubs.setMatrixAt(count,dummy.matrix);
   shrubs.setColorAt(count++,new THREE.Color().setHSL(.22+this.random()*.035,.18+this.random()*.15,.77+this.random()*.16));
  }
  shrubs.count=count;shrubs.name='alpine-understory';shrubs.receiveShadow=true;shrubs.castShadow=true;shrubs.computeBoundingSphere();this.scene.add(shrubs);
  console.info('[world] understory ready',{shrubs:count});
 }
 private naturalObstacles(){
  if(MOUNTAIN_COURSE){
   // Bedded outcrops, not scattered polyhedra. Each cluster shares a strike and dip, and
   // every stone is sunk into the ground, so rock reads as exposed bedrock.
   const slabs=new THREE.InstancedMesh(slabGeometry,mat('#9a978e'),96);
   const blocks=new THREE.InstancedMesh(blockGeometry,mat('#8e9188'),150);
   const caps=new THREE.InstancedMesh(blockGeometry,ivory,120),dummy=new THREE.Object3D();
   let slabCount=0,blockCount=0,snowCount=0;
   const clusters=MOUNTAIN_COURSE?34:0;
   for(let c=0;c<clusters;c++){
    const angle=this.random()*Math.PI*2,radius=(.30+Math.pow(this.random(),.7)*.62)*COURSE_SCALE;
    const cx=Math.cos(angle)*radius*62,cz=Math.sin(angle)*73*radius-7*COURSE_SCALE;
    const centerH=this.height(cx,cz),centerSlope=this.terrainField.slope(cx,cz),near=this.nearest(cx,cz);
    // Outcrops live on steep, exposed ground only: the same rule the surface colour uses.
    const exposure=rockExposure(cx,cz,centerH,centerSlope,smooth(18,96,centerH));
    if(exposure<.30||centerH<LAKE_LEVEL+4||near.distance<near.p.width+3)continue;
    const strike=this.random()*Math.PI*2,dip=.16+this.random()*.34;
    const spread=2.2+this.random()*4.6;
    for(let i=0;i<3+Math.floor(this.random()*4)&&slabCount<96;i++){
     const ox=(this.random()-.5)*spread,oz=(this.random()-.5)*spread;
     const x=cx+ox,z=cz+oz,h=this.height(x,z);
     if(exposure<.22||h<LAKE_LEVEL+3.5)continue;
     const size=.5+this.random()*1.15;
     // Sunk proportionally to size and to how flat the ground is, so stones never float.
     dummy.position.set(x,h-size*.34,z);
     dummy.rotation.set(dip*(this.random()-.5)*.5,strike+(this.random()-.5)*.3,dip);
     dummy.scale.set(size*1.55,size*.44,size*(.85+this.random()*.5));
     dummy.updateMatrix();slabs.setMatrixAt(slabCount++,dummy.matrix);
    }
    for(let i=0;i<2+Math.floor(this.random()*4)&&blockCount<150;i++){
     const ox=(this.random()-.5)*spread*1.5,oz=(this.random()-.5)*spread*1.5;
     const x=cx+ox,z=cz+oz,h=this.height(x,z);
     if(h<LAKE_LEVEL+2.5)continue;
     const size=.35+Math.pow(this.random(),1.6)*1.5;
     dummy.position.set(x,h-size*(.30+this.random()*.22),z);
     dummy.rotation.set((this.random()-.5)*.5,this.random()*Math.PI*2,(this.random()-.5)*.5);
     dummy.scale.set(size*(1+this.random()*.5),size*(.68+this.random()*.42),size*(.8+this.random()*.45));
     dummy.updateMatrix();blocks.setMatrixAt(blockCount++,dummy.matrix);
     // Snow only stays on the flat tops of perched blocks above the snowline.
     if(this.random()<(alpineBiome(x,z,h,this.terrainField.slope(x,z)).snow-.30)/.6&&snowCount<120){
      dummy.position.y+=size*.42;dummy.scale.set(size*1.16,size*.20,size*.9);
      dummy.rotation.set(0,dummy.rotation.y,0);dummy.updateMatrix();caps.setMatrixAt(snowCount++,dummy.matrix);
     }
    }
   }
   slabs.count=slabCount;blocks.count=blockCount;caps.count=snowCount;
   for(const m of [slabs,blocks,caps]){m.castShadow=true;m.receiveShadow=true;m.computeBoundingSphere();this.scene.add(m);}
   slabs.name='alpine-bedrock-slabs';blocks.name='alpine-boulders';caps.name='alpine-snowcaps';
   console.info('[world] alpine rock ready',{slabs:slabCount,boulders:blockCount,snowcaps:snowCount});
  }
  for(const b of blockers){
   const root=new THREE.Group(),p=world(b.s,b.lane);root.name=`natural-${b.kind}`;root.position.set(p.x,p.y-.25,p.z);root.rotation.y=Math.atan2(sample(b.s).tx,sample(b.s).tz);
   const stone=mesh(new THREE.DodecahedronGeometry(1,1),mat(b.kind==='island'?'#b4ac83':'#88968e'),[0,0,0],[b.radius,b.kind==='island'?.7:1,b.length/2]);root.add(stone);
   if(b.kind==='island')ball(root,grass,[0,.3,0],[b.radius*.9,.35,b.length*.43]);
   this.scene.add(root);
  }
 }
 gate(s:number,label:string){const p=sample(s),root=new THREE.Group();root.position.set(p.x,p.y,p.z);root.rotation.y=Math.atan2(p.tx,p.tz);for(const x of [-p.width,p.width]){box(root,wood,[x,2.1,0],[.25,4.5,.25]);ball(root,orange,[x,4.5,0],[.25,.25,.25]);}const sign=mesh(new THREE.PlaneGeometry(p.width*2,1.35),new THREE.MeshStandardMaterial({map:textTexture(label),side:THREE.DoubleSide}),[0,3.6,0]);root.add(sign);if(label==='FINISH'){for(let i=0;i<16;i++){const tile=mesh(new THREE.PlaneGeometry(p.width/4,.75),i%2?ivory:dark,[-p.width+(i%8+.5)*p.width/4,.1,Math.floor(i/8)*.75]);tile.rotation.x=-Math.PI/2;root.add(tile);}}this.scene.add(root);}
 obstacle(kind:string,s:number){const p=sample(s),root=new THREE.Group(),part=new THREE.Group();root.position.set(p.x,p.y,p.z);root.rotation.y=Math.atan2(p.tx,p.tz);root.add(part);if(kind==='pendulum'){for(const x of [-p.width-.3,p.width+.3])box(root,wood,[x,3.4,0],[.42,6.8,.42]);box(root,wood,[0,6.7,0],[p.width*2+1,.5,.5]);part.position.y=6.4;pole(part,new THREE.Vector3(),new THREE.Vector3(0,-4.7,0),.095,dark);ball(part,orange,[0,-4.7,0],[1.15,1.15,1.15]);const stripe=mesh(new THREE.TorusGeometry(1.16,.07,6,32),ivory,[0,-4.7,0]);stripe.rotation.x=Math.PI/2;part.add(stripe);}if(kind==='wheel'||kind==='windmill'){box(root,wood,[0,1.7,0],[p.width*2+1,.3,.3]);for(const x of [-p.width,p.width])box(root,wood,[x,1,0],[.5,3.6,.6]);part.position.y=WHEEL.height;pole(part,new THREE.Vector3(0,-1,0),new THREE.Vector3(0,2,0),.25,wood);for(let i=0;i<WHEEL.arms;i++){const paddle=new THREE.Group();paddle.rotation.y=i*Math.PI/2;for(const [shape,material]of [[WHEEL.arm,wood],[WHEEL.paddle,orange]] as const)box(paddle,material,[0,shape.y,shape.z],[shape.width,shape.height,shape.length]);part.add(paddle);}const hub=ball(part,ivory,[0,WHEEL.hub.y,0],[WHEEL.hub.width/2,WHEEL.hub.height/2,WHEEL.hub.length/2]);hub.castShadow=true;}if(kind==='bars'){for(const z of [-.75,.75]){for(const x of [-p.width,p.width])box(root,wood,[x,1.6,z],[.3,3.5,.3]);const bar=box(part,orange,[0,0,z],[p.width*2,.34,.34]);for(let i=0;i<7;i++)box(bar,ivory,[(i-3)*.12,0,0],[.045,1.03,1.03]);}}if(kind==='fan'){root.position.copy(new THREE.Vector3(p.x+p.tz*(p.width+.8),p.y,p.z-p.tx*(p.width+.8)));root.rotation.y=Math.atan2(p.tx,p.tz)+.35;box(root,wood,[0,1.2,0],[.4,2.5,.4]);const cage=mesh(new THREE.TorusGeometry(1.25,.14,8,32),ivory,[0,2.5,0]);root.add(cage);part.position.y=2.5;for(let i=0;i<4;i++){const blade=ball(part,orange,[Math.cos(i*Math.PI/2)*.6,Math.sin(i*Math.PI/2)*.6,0],[.64,.22,.1]);blade.rotation.z=i*Math.PI/2;}ball(part,wood,[0,0,.12],[.27,.27,.2]);}this.scene.add(root);this.moving.push({kind,root,part});}
 /** Conservative scenery proxies plus terrain samples keep water and racers out
  * of camera obstruction checks. No mesh/material mutation or transparency hacks. */
 clearCameraView=(target:THREE.Vector3,position:THREE.Vector3)=>{
  const distance=target.distanceTo(position);this.cameraDirection.subVectors(position,target).normalize();this.cameraRay.set(target,this.cameraDirection);
  for(const box of this.cameraBoxes){const hit=this.cameraRay.intersectBox(box,this.cameraHit);if(hit){const along=hit.distanceTo(target);if(along>1.5&&along<distance+1)return false;}}
  for(let along=2;along<=distance;along+=1.4){const t=along/distance,x=target.x+(position.x-target.x)*t,z=target.z+(position.z-target.z)*t,y=target.y+(position.y-target.y)*t;if(y<this.height(x,z)+.7)return false;}
  return position.y>this.height(position.x,position.z)+1;
 };
 setDucks(count:number,colors?:readonly (string|null)[]){
  const next=Array.from({length:count},(_,i)=>colors?.[i]??COLORS[i]),changed=next.some((c,i)=>c!==this.duckColors[i]);
  if(this.duckMeshes.length===count&&!changed)return;
  this.duckColors=next;for(const d of this.duckMeshes)this.scene.remove(d);
  this.duckMeshes=Array.from({length:count},(_,i)=>{let root=this.duckPool[i];if(!root)root=this.duckPool[i]=new THREE.Group();if(!root.children.length||root.userData.color!==next[i]){root.clear();root.add(this.generatedAssets.has('duck')?this.generatedAssets.duck(next[i],i):duckModel(next[i]));root.userData.color=next[i];}this.scene.add(root);return root;});
 }

 update(t:number,race:Race,hits:readonly number[]=[]){this.atmosphere?.update(t);const waterTime=race.state==='ready'?t:race.floatTime;this.water.update(waterTime);this.effects.update(race);this.audience?.update(t,race,this.reducedMotion);this.springRipples.forEach((ring,i)=>{const phase=(waterTime*.55+i/4)%1;ring.scale.setScalar(.35+phase*2.2);ring.material.opacity=(1-phase)*.28;});for(const {kind,part}of this.moving){if(kind==='pendulum')part.rotation.z=-Math.asin(Math.sin(race.time*1.8)*2.8/4.7);if(kind==='wheel'||kind==='windmill')part.rotation.y=race.time*WHEEL.speed;if(kind==='wind-rotor')part.rotation.z=-race.time*.9;if(kind==='mill-waterwheel')part.rotation.x=race.time*.9;if(kind==='bars')part.position.y=.7+(1-Math.sin(race.time*1.5))*1.3;if(kind==='fan')part.rotation.z=t*14;}
 this.coneAxis.set(race.cone.along,0,race.cone.lateral);this.conePivot.quaternion.setFromAxisAngle(this.coneAxis,race.cone.tilt);
 for(const item of this.moving)item.root.updateMatrixWorld(true);for(const item of this.movingCameraBoxes)item.box.setFromObject(item.mesh).expandByScalar(.35);
 const dummy=this.frameDummy;for(const d of race.ducks){const m=this.duckMeshes[d.id];const p=world(d.s,d.lane);m.position.set(p.x,d.y,p.z);const dir=sample(d.s);m.rotation.order='YXZ';const swim=d.airborne?0:Math.sin(waterTime*(7+Math.min(3,d.v*.15))+d.id*2.1),yaw= d.yaw*.35+swim*.075; m.rotation.set(d.pitch,Math.atan2(dir.tx,dir.tz)+yaw,d.roll+swim*.085);for(let k=0;k<6;k++){const s=Math.max(0,d.s-k*.6-.5),a=world(s,d.lane);dummy.position.set(a.x,a.y+.14+waterWave(s,d.lane,bankDistance(s,d.lane),waterTime),a.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(d.airborne?0:.6+k*.19);dummy.updateMatrix();this.trail.setMatrixAt(d.id*6+k,dummy.matrix);}}
 for(const d of race.ducks){const p=world(d.s,d.lane),age=race.floatTime-(hits[d.id]??-99);dummy.position.set(p.x,d.y+.27,p.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(age>=0&&age<1.1?1+age*2:0);dummy.updateMatrix();this.hitHalos.setMatrixAt(d.id,dummy.matrix);}this.hitHalos.count=race.ducks.length;this.hitHalos.instanceMatrix.needsUpdate=true;
 this.trail.count=race.ducks.length*6;this.trail.instanceMatrix.needsUpdate=true;
 if(waterTime!==this.lastFoamTime){this.lastFoamTime=waterTime;for(let i=0;i<230;i++){const s=(i/230*TRACK_LENGTH+waterTime*(2.2+(i%5)*.2))%TRACK_LENGTH,p=sample(s),lane=Math.sin(i*137.5)*bankWidth(s,Math.sin(i*137.5))*.9,v=world(s,lane);dummy.position.set(v.x,v.y+.10+waterWave(s,lane,bankDistance(s,lane),waterTime),v.z);dummy.rotation.set(0,Math.atan2(p.tx,p.tz),0);const size=inFall(s)?0:.035+(i%4)*.017;dummy.scale.set(size,.025,size*3.3);dummy.updateMatrix();this.foam.setMatrixAt(i,dummy.matrix);}this.foam.instanceMatrix.needsUpdate=true;}
 this.birds.forEach((b,i)=>{const a=t*.09+i*.8;b.position.set(Math.sin(a)*31,37+Math.sin(a*.8+i)*6,Math.cos(a)*23);b.rotation.y=-a;b.userData.left.rotation.z=Math.sin(t*6+i)*.4;b.userData.right.rotation.z=-Math.sin(t*6+i)*.4;});this.rabbits.forEach((r,i)=>{const phase=(t+i*4)%12;r.position.copy(r.userData.base);if(phase<1.2)r.position.y+=Math.abs(Math.sin(phase*Math.PI*2/1.2))*.65;});}
}
