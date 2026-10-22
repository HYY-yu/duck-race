import * as THREE from 'three';
import {sample,world,TRACK_LENGTH,LAKE_LEVEL,obstacles,inFall} from './track';
import {WaterSystem,captureWaterEnvironment} from './water';
import {ImpactEffects} from './impact-effects';
import {waterWave} from './water-wave';
import {COLORS,type Race} from './simulation';
const mat=(color:THREE.ColorRepresentation,roughness=.82)=>new THREE.MeshStandardMaterial({color,roughness});
const grass=mat('#92b88a'),wood=mat('#976c48'),ivory=mat('#fff9e7'),dark=mat('#263d3a'),orange=mat('#f2a04c');
const sphere=new THREE.SphereGeometry(1,20,14);
function mesh(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Vector3|number[]=[0,0,0],scale?:number[]){const o=new THREE.Mesh(g,m);o.position.fromArray(Array.isArray(p)?p:p.toArray());if(scale)o.scale.fromArray(scale);o.castShadow=true;o.receiveShadow=true;return o;}
function ball(parent:THREE.Object3D,m:THREE.Material,p:number[],scale:number[]){const o=mesh(sphere,m,p,scale);parent.add(o);return o;}
function box(parent:THREE.Object3D,m:THREE.Material,p:number[],scale:number[]){const o=mesh(new THREE.BoxGeometry(1,1,1),m,p,scale);parent.add(o);return o;}
function pole(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material){const o=mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),m,a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());parent.add(o);return o;}
function textTexture(text:string,bg='#fff9e7',fg='#2e5550'){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=fg;ctx.fillText(text,256,68);return new THREE.CanvasTexture(c);}
export function duckModel(color:string){const g=new THREE.Group(),m=mat(color,.24),beak=mat('#f49b39',.35);ball(g,m,[0,.65,0],[.78,.61,1.04]);ball(g,m,[0,1.36,.55],[.58,.59,.57]);ball(g,beak,[0,1.22,1.06],[.42,.16,.35]);ball(g,m,[-.64,.72,-.1],[.22,.35,.62]);ball(g,m,[.64,.72,-.1],[.22,.35,.62]);const tail=ball(g,m,[0,.85,-.91],[.34,.35,.45]);tail.rotation.x=-.5;for(const x of [-.47,.47]){ball(g,dark,[x,1.49,.84],[.083,.105,.075]);ball(g,ivory,[x*.99,1.52,.898],[.028,.033,.022]);}return g;}
// Smooth deterministic value noise avoids periodic stripes in terrain relief and colour.
function terrainNoise(x:number,z:number){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const hash=(a:number,b:number)=>{const h=Math.sin(a*127.1+b*311.7+19.3)*43758.5453;return h-Math.floor(h);};
 const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
 return ((a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v)*2-1;
}
export class World {
 scene=new THREE.Scene();duckMeshes:THREE.Group[]=[];private duckPool:THREE.Group[]=[];water:WaterSystem;effects:ImpactEffects;moving:{kind:string;root:THREE.Group;part:THREE.Group}[]=[];birds:THREE.Group[]=[];rabbits:THREE.Group[]=[];foam:THREE.InstancedMesh;trail:THREE.InstancedMesh;private springRipples:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>[]=[];private randSeed=12;
 private riverSamples=Array.from({length:Math.ceil(TRACK_LENGTH/1.8)+1},(_,i)=>{const s=Math.min(TRACK_LENGTH,i*1.8);return {s,p:sample(s)};});
 random(){this.randSeed=(Math.imul(this.randSeed,1664525)+1013904223)>>>0;return this.randSeed/4294967296;}
 constructor(renderer:THREE.WebGLRenderer){this.scene.background=new THREE.Color('#e9eee5');this.scene.fog=new THREE.Fog('#e9eee5',155,290);this.scene.add(new THREE.HemisphereLight('#fff7df','#718a77',2.65));const sun=new THREE.DirectionalLight('#fff3d9',3.4);sun.position.set(-35,70,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:180});sun.shadow.bias=-.0003;sun.shadow.normalBias=.12;this.scene.add(sun);
 const ground=mesh(new THREE.PlaneGeometry(2000,2000),mat('#e9eee5'),[0,-6,0]);ground.rotation.x=-Math.PI/2;this.scene.add(ground);
 this.terrain();this.coast();
 this.decorate();this.river();const environment=captureWaterEnvironment(renderer,this.scene);
 this.water=new WaterSystem(this.scene,environment.texture);this.effects=new ImpactEffects(this.scene);
 for(const o of obstacles)this.obstacle(o.kind,o.s);this.gate(7,'START');this.gate(TRACK_LENGTH-2,'FINISH');
 this.foam=new THREE.InstancedMesh(sphere,new THREE.MeshBasicMaterial({color:'#d7eee5',transparent:true,opacity:.42}),230);this.foam.castShadow=false;this.scene.add(this.foam);this.trail=new THREE.InstancedMesh(new THREE.RingGeometry(.3,.37,24,1,0,Math.PI),new THREE.MeshBasicMaterial({color:'#d3fff0',transparent:true,opacity:.26,side:THREE.DoubleSide}),72);this.scene.add(this.trail);
 this.spring();
 for(let i=0;i<7;i++){const bird=new THREE.Group();const body=ball(bird,ivory,[0,0,0],[.13,.16,.4]);body.rotation.x=.2;const left=box(bird,ivory,[-.4,0,0],[.8,.065,.22]),right=box(bird,ivory,[.4,0,0],[.8,.065,.22]);bird.userData={left,right};this.birds.push(bird);this.scene.add(bird);}
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
 nearest(x:number,z:number){
  let distance=Infinity,s=0;
  // Project onto each segment instead of snapping to isolated stations.
  for(let i=0;i<this.riverSamples.length-1;i++){
   const a=this.riverSamples[i],b=this.riverSamples[i+1],dx=b.p.x-a.p.x,dz=b.p.z-a.p.z;
   const t=Math.max(0,Math.min(1,((x-a.p.x)*dx+(z-a.p.z)*dz)/(dx*dx+dz*dz||1)));
   const dist=Math.hypot(x-a.p.x-dx*t,z-a.p.z-dz*t);
   if(dist<distance){distance=dist;s=a.s+(b.s-a.s)*t;}
  }
  return {distance,s,p:sample(s)};
 }
 // A rounded, asymmetric island envelope replaces the rectangular terrain cut-off.
 islandRadius(x:number,z:number){const angle=Math.atan2((z+7)/65,x/53);return Math.hypot(x/53,(z+7)/65)/(1+.075*Math.sin(angle*3+.6)+.045*Math.cos(angle*5));}
 height(x:number,z:number){
  const {distance:d,p}=this.nearest(x,z),bank=Math.max(0,d-p.width+.8);
  let h=p.y-.8-3*Math.max(0,1-d/(p.width+.4))+Math.min(6.5,bank*.5)+(terrainNoise(x*.09,z*.09)+.3*terrainNoise(x*.21+13,z*.21-9))*Math.min(1.25,bank*.25);
  const radius=this.islandRadius(x,z),t=Math.max(0,Math.min(1,(radius-.5)/.5)),fade=t*t*(3-2*t);
  const shelf=LAKE_LEVEL+33*Math.pow(1-fade,1.6)-Math.max(0,radius-.92)*27;
  h=Math.min(h,shelf);
  const coast=Math.max(0,Math.min(1,(z-31)/12));h-=coast*coast*(3-2*coast)*5;
  return Math.max(-5,h);
 }
 terrain(){const g=new THREE.PlaneGeometry(134,158,120,140);g.rotateX(-Math.PI/2);const positions=g.attributes.position;const colors=[];const color=new THREE.Color();for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i)-3;const h=this.height(x,z);positions.setXYZ(i,x,h,z);const variation=terrainNoise(x*.18+7,z*.18)*.024; color.set(h<LAKE_LEVEL-.5?'#8aa99b':h<LAKE_LEVEL+.9?'#d9cfaa':h<LAKE_LEVEL+2.4?'#b7c195':'#91b682');color.offsetHSL(variation*.3,variation,variation);colors.push(color.r,color.g,color.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();const m=mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));this.scene.add(m);}
 coast(){
  // Scattered shoreline rocks sit on the same height field as the beach.
  const geometry=new THREE.DodecahedronGeometry(1,0),rocks=new THREE.InstancedMesh(geometry,mat('#a3aaa0'),88),dummy=new THREE.Object3D();
  let count=0;
  for(let i=0;i<88;i++){
   const angle=i/88*Math.PI*2+.035*Math.sin(i*2.7),cx=Math.cos(angle),sz=Math.sin(angle);
   let lo=.52,hi=1.2;
   for(let step=0;step<15;step++){const r=(lo+hi)/2;if(this.height(cx*53*r,sz*65*r-7)>LAKE_LEVEL+.2)lo=r;else hi=r;}
   const r=(lo+hi)/2,x=cx*53*r,z=sz*65*r-7,near=this.nearest(x,z);
   if(near.distance<near.p.width+1.8)continue;
   const size=.35+this.random()*.75;dummy.position.set(x,this.height(x,z)-.05,z);dummy.rotation.set(this.random(),this.random()*6,this.random());dummy.scale.set(size*1.5,size*.65,size);dummy.updateMatrix();rocks.setMatrixAt(count++,dummy.matrix);
  }
  rocks.count=count;rocks.receiveShadow=true;rocks.castShadow=true;rocks.name='island-shore-rocks';this.scene.add(rocks);
  console.info('[world] island coast ready',{rocks:count,waterLevel:LAKE_LEVEL});
 }
 river(){
 // Rounded stones and pale banks make the channel readable from the overview.
 const rockGeo=new THREE.DodecahedronGeometry(1,0);const rocks=new THREE.InstancedMesh(rockGeo,mat('#b5b9a2'),330);const dummy=new THREE.Object3D();for(let i=0;i<330;i++){const s=i/330*TRACK_LENGTH,p=sample(s),side=i%2?1:-1,v=world(s,side*(p.width+.45));dummy.position.set(v.x,v.y-.12,v.z);dummy.rotation.set(this.random(),this.random()*6,this.random());dummy.scale.set(.55+this.random()*.55,.4+this.random()*.35,.65+this.random()*.6);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.castShadow=true;rocks.receiveShadow=true;this.scene.add(rocks);
 }
 decorate(){const trunks:THREE.Matrix4[]=[],crowns:THREE.Matrix4[]=[],rounds:THREE.Matrix4[]=[];const dummy=new THREE.Object3D();for(let i=0;i<270;i++){const x=(this.random()-.5)*80,z=(this.random()-.5)*92-2;const near=this.nearest(x,z);if(near.distance<near.p.width+3||this.height(x,z)<1||z>37)continue;const h=this.height(x,z),size=.65+this.random()*.7;dummy.position.set(x,h+1.3*size,z);dummy.scale.set(.22*size,2.6*size,.22*size);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.push(dummy.matrix.clone());if(i%4===0){dummy.position.y=h+3.4*size;dummy.scale.set(1.7*size,2.3*size,1.7*size);dummy.updateMatrix();rounds.push(dummy.matrix.clone());}else{for(let k=0;k<3;k++){dummy.position.y=h+(2.4+k*1.25)*size;dummy.scale.set((2-k*.37)*size,(3.3-k*.35)*size,(2-k*.37)*size);dummy.rotation.y=i;dummy.updateMatrix();crowns.push(dummy.matrix.clone());}}}
 const batches:[[THREE.BufferGeometry,THREE.Material,THREE.Matrix4[]],[THREE.BufferGeometry,THREE.Material,THREE.Matrix4[]],[THREE.BufferGeometry,THREE.Material,THREE.Matrix4[]]]=[[new THREE.CylinderGeometry(1,1,1,6),wood,trunks],[new THREE.ConeGeometry(1,1,7),mat('#427e69'),crowns],[new THREE.IcosahedronGeometry(1,1),mat('#7fa665'),rounds]];for(const [geo,m,arr]of batches){const o=new THREE.InstancedMesh(geo,m,arr.length);arr.forEach((matrix,i)=>o.setMatrixAt(i,matrix));o.castShadow=true;o.receiveShadow=true;this.scene.add(o);}
 for(let i=0;i<28;i++){const s=this.random()*TRACK_LENGTH,p=sample(s),v=world(s,p.width+2+this.random()*2);const r=mesh(new THREE.DodecahedronGeometry(1,0),mat(i%3?'#b3baa5':'#d2cdb5'),[v.x,this.height(v.x,v.z)+.2,v.z],[1+this.random(),.8+this.random(),1.1]);this.scene.add(r);}
 for(const s of [28,105,185]){const p=sample(s),v=world(s,p.width+3);const rabbit=new THREE.Group();const m=mat('#f6eed9');ball(rabbit,m,[0,.4,0],[.43,.43,.65]);ball(rabbit,m,[0,.75,.44],[.32,.34,.31]);for(const x of [-.15,.15]){ball(rabbit,m,[x,1.18,.42],[.11,.42,.12]);ball(rabbit,mat('#dfa69a'),[x,1.2,.52],[.052,.27,.025]);ball(rabbit,dark,[x*1.5,.8,.65],[.04,.05,.04]);}ball(rabbit,ivory,[0,.5,-.62],[.2,.2,.2]);rabbit.position.set(v.x,this.height(v.x,v.z)+.2,v.z);rabbit.rotation.y=s;rabbit.userData.base=rabbit.position.clone();this.rabbits.push(rabbit);this.scene.add(rabbit);}
 // Footbridge beside the lake.
 const bridge=new THREE.Group();bridge.position.set(-1,3.4,40);bridge.rotation.y=-.3;for(let i=0;i<12;i++)box(bridge,wood,[(i-5.5)*.6,0,0],[.54,.2,3]);for(const z of [-1.6,1.6]){pole(bridge,new THREE.Vector3(-3.7,1.3,z),new THREE.Vector3(3.7,1.3,z),.09,wood);for(const x of [-3.4,0,3.4])box(bridge,wood,[x,.65,z],[.15,1.5,.15]);}this.scene.add(bridge);
 }
 gate(s:number,label:string){const p=sample(s),root=new THREE.Group();root.position.set(p.x,p.y,p.z);root.rotation.y=Math.atan2(p.tx,p.tz);for(const x of [-p.width,p.width]){box(root,wood,[x,2.1,0],[.25,4.5,.25]);ball(root,orange,[x,4.5,0],[.25,.25,.25]);}const sign=mesh(new THREE.PlaneGeometry(p.width*2,1.35),new THREE.MeshStandardMaterial({map:textTexture(label),side:THREE.DoubleSide}),[0,3.6,0]);root.add(sign);if(label==='FINISH'){for(let i=0;i<16;i++){const tile=mesh(new THREE.PlaneGeometry(p.width/4,.75),i%2?ivory:dark,[-p.width+(i%8+.5)*p.width/4,.1,Math.floor(i/8)*.75]);tile.rotation.x=-Math.PI/2;root.add(tile);}}this.scene.add(root);}
 obstacle(kind:string,s:number){const p=sample(s),root=new THREE.Group(),part=new THREE.Group();root.position.set(p.x,p.y,p.z);root.rotation.y=Math.atan2(p.tx,p.tz);root.add(part);if(kind==='pendulum'){for(const x of [-p.width-.3,p.width+.3])box(root,wood,[x,3.4,0],[.42,6.8,.42]);box(root,wood,[0,6.7,0],[p.width*2+1,.5,.5]);part.position.y=6.4;pole(part,new THREE.Vector3(),new THREE.Vector3(0,-4.7,0),.095,dark);ball(part,orange,[0,-4.7,0],[1.15,1.15,1.15]);const stripe=mesh(new THREE.TorusGeometry(1.16,.07,6,32),ivory,[0,-4.7,0]);stripe.rotation.x=Math.PI/2;part.add(stripe);}if(kind==='wheel'){box(root,wood,[0,1.7,0],[p.width*2+1,.3,.3]);for(const x of [-p.width,p.width])box(root,wood,[x,1,0],[.5,3.6,.6]);part.position.y=1.1;pole(part,new THREE.Vector3(0,-1,0),new THREE.Vector3(0,2,0),.25,wood);for(let i=0;i<4;i++){const paddle=new THREE.Group();paddle.rotation.y=i*Math.PI/2;box(paddle,wood,[0,0,1.5],[.15,.2,3]);box(paddle,orange,[0,-.1,2.6],[1.5,1.2,.3]);part.add(paddle);}const hub=ball(part,ivory,[0,.2,0],[.6,.25,.6]);hub.castShadow=true;}if(kind==='bars'){for(const z of [-.75,.75]){for(const x of [-p.width,p.width])box(root,wood,[x,1.6,z],[.3,3.5,.3]);const bar=box(part,orange,[0,0,z],[p.width*2,.34,.34]);for(let i=0;i<7;i++)box(bar,ivory,[(i-3)*.12,0,0],[.045,1.03,1.03]);}}if(kind==='fan'){root.position.copy(new THREE.Vector3(p.x+p.tz*(p.width+.8),p.y,p.z-p.tx*(p.width+.8)));root.rotation.y=Math.atan2(p.tx,p.tz)+.35;box(root,wood,[0,1.2,0],[.4,2.5,.4]);const cage=mesh(new THREE.TorusGeometry(1.25,.14,8,32),ivory,[0,2.5,0]);root.add(cage);part.position.y=2.5;for(let i=0;i<4;i++){const blade=ball(part,orange,[Math.cos(i*Math.PI/2)*.6,Math.sin(i*Math.PI/2)*.6,0],[.64,.22,.1]);blade.rotation.z=i*Math.PI/2;}ball(part,wood,[0,0,.12],[.27,.27,.2]);}this.scene.add(root);this.moving.push({kind,root,part});}
 setDucks(count:number){if(this.duckMeshes.length===count)return;for(const d of this.duckMeshes)this.scene.remove(d);this.duckMeshes=Array.from({length:count},(_,i)=>{const d=this.duckPool[i]??(this.duckPool[i]=duckModel(COLORS[i]));this.scene.add(d);return d;});}
 update(t:number,race:Race){const waterTime=race.state==='ready'?t:race.floatTime;this.water.update(waterTime);this.effects.update(race);this.springRipples.forEach((ring,i)=>{const phase=(waterTime*.55+i/4)%1;ring.scale.setScalar(.35+phase*2.2);ring.material.opacity=(1-phase)*.28;});for(const {kind,part}of this.moving){if(kind==='pendulum')part.rotation.z=-Math.asin(Math.sin(race.time*1.8)*2.8/4.7);if(kind==='wheel')part.rotation.y=race.time*.9;if(kind==='bars')part.position.y=.7+(1-Math.sin(race.time*1.5))*1.3;if(kind==='fan')part.rotation.z=t*14;}
 const dummy=new THREE.Object3D();for(const d of race.ducks){const m=this.duckMeshes[d.id];const p=world(d.s,d.lane);m.position.set(p.x,d.y,p.z);const dir=sample(d.s);m.rotation.order='YXZ';m.rotation.set(d.pitch,Math.atan2(dir.tx,dir.tz)+d.yaw,d.roll);for(let k=0;k<6;k++){const s=Math.max(0,d.s-k*.6-.5),a=world(s,d.lane);dummy.position.set(a.x,a.y+.14+waterWave(s,d.lane,dir.width-Math.abs(d.lane),waterTime),a.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(d.airborne?0:.6+k*.19);dummy.updateMatrix();this.trail.setMatrixAt(d.id*6+k,dummy.matrix);}}
 this.trail.count=race.ducks.length*6;this.trail.instanceMatrix.needsUpdate=true;
 for(let i=0;i<230;i++){const s=(i/230*TRACK_LENGTH+waterTime*(2.2+(i%5)*.2))%TRACK_LENGTH,p=sample(s),lane=Math.sin(i*137.5)*p.width*.9,v=world(s,lane);dummy.position.set(v.x,v.y+.10+waterWave(s,lane,p.width-Math.abs(lane),waterTime),v.z);dummy.rotation.set(0,Math.atan2(p.tx,p.tz),0);const size=inFall(s)?0:.035+(i%4)*.017;dummy.scale.set(size,.025,size*3.3);dummy.updateMatrix();this.foam.setMatrixAt(i,dummy.matrix);}this.foam.instanceMatrix.needsUpdate=true;
 this.birds.forEach((b,i)=>{const a=t*.09+i*.8;b.position.set(Math.sin(a)*31,37+Math.sin(a*.8+i)*6,Math.cos(a)*23);b.rotation.y=-a;b.userData.left.rotation.z=Math.sin(t*6+i)*.4;b.userData.right.rotation.z=-Math.sin(t*6+i)*.4;});this.rabbits.forEach((r,i)=>{const phase=(t+i*4)%12;r.position.copy(r.userData.base);if(phase<1.2)r.position.y+=Math.abs(Math.sin(phase*Math.PI*2/1.2))*.65;});}
}
