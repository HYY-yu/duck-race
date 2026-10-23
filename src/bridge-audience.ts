import * as THREE from 'three';
import {TRACK_LENGTH,world} from './track';
import type {Race} from './simulation';
import {AudienceDirector} from './audience-behavior';
import {GeneratedAssets, type ModelId} from './generated-assets';
const sphere=new THREE.SphereGeometry(1,14,10);
const material=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.85});
const cream=material('#fff2d8'),pink=material('#e7aca2'),dark=material('#34473e');
function ball(parent:THREE.Object3D,mat:THREE.Material,position:number[],scale:number[]){
 const mesh=new THREE.Mesh(sphere,mat);mesh.position.fromArray(position);mesh.scale.fromArray(scale);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
type Spectator={root:THREE.Group;head:THREE.Object3D;arms:THREE.Object3D[];pupils:THREE.Mesh[];y:number;phase:number;baseYaw:number};
/** A fixed-size, render-only welcoming party. Animation follows the race clock,
 * so pausing freezes cheers and reset never carries over a finish celebration. */
export class BridgeAudience {
 private spectators:Spectator[]=[];private director=new AudienceDirector();private lastClock=-1;private generation=-1;private targetPosition=new THREE.Vector3();
 constructor(bridge:THREE.Group){
  bridge.updateMatrixWorld(true);const end=world(TRACK_LENGTH+5),toward=bridge.worldToLocal(new THREE.Vector3(end.x,3.4,end.z));
  const roster=[{kind:'rabbit',color:'#eee6d3',x:-2.55},{kind:'bear',color:'#a6805b',x:-.85},{kind:'fox',color:'#dc9159',x:.85},{kind:'rabbit',color:'#c4cbd8',x:2.55}];
  roster.forEach(({kind,color,x},i)=>{
   const fur=material(color),root=new THREE.Group(),head=new THREE.Group(),arms:THREE.Group[]=[],pupils:THREE.Mesh[]=[];
   root.name=`bridge-spectator-${kind}-${i}`;root.position.set(x,.11,.1);root.rotation.y=Math.atan2(toward.x-x,toward.z-.1);root.scale.setScalar(.87);
   ball(root,fur,[0,.9,0],[.5,.65,.38]);ball(root,cream,[0,.87,.31],[.33,.43,.12]);
   for(const side of [-1,1]){
    ball(root,fur,[side*.27,.16,.15],[.24,.17,.35]);
    const arm=new THREE.Group();arm.position.set(side*.47,1.25,0);ball(arm,fur,[0,-.29,0],[.18,.36,.18]);ball(arm,cream,[0,-.57,0],[.19,.18,.19]);arms.push(arm);root.add(arm);
   }
   head.name=`spectator-gaze-${i}`;head.position.y=1.66;root.add(head);ball(head,fur,[0,0,0],[.52,.49,.44]);
   ball(head,cream,[0,-.16,.36],[.33,.23,.18]);const nose=ball(head,dark,[0,-.08,.51],[.085,.065,.055]);nose.castShadow=false;
   for(const side of [-1,1]){
    const eye=ball(head,cream,[side*.22,.08,.397],[.09,.10,.045]);eye.castShadow=false;const pupil=ball(head,dark,[side*.22,.08,.438],[.047,.061,.025]);pupil.castShadow=false;pupils.push(pupil);
    if(kind==='rabbit'){ball(head,fur,[side*.24,.65,-.02],[.15,.5,.14]);ball(head,pink,[side*.24,.67,.10],[.075,.35,.025]);}
    else if(kind==='bear'){ball(head,fur,[side*.43,.35,-.04],[.22,.23,.16]);ball(head,cream,[side*.43,.36,.10],[.12,.13,.025]);}
    else{const ear=new THREE.Mesh(new THREE.ConeGeometry(.23,.58,3),fur);ear.position.set(side*.34,.46,-.02);ear.rotation.z=-side*.2;ear.castShadow=true;head.add(ear);ball(head,pink,[side*.34,.46,.12],[.09,.13,.025]);}
   }
   if(kind==='fox'){const tail=ball(root,fur,[.25,.64,-.56],[.26,.27,.63]);tail.rotation.y=-.35;ball(root,cream,[.43,.7,-1.02],[.23,.23,.27]);}
   else ball(root,kind==='rabbit'?cream:fur,[0,.6,-.39],[.2,.2,.2]);
   bridge.add(root);this.spectators.push({root,head,arms,pupils,y:.11,phase:i*1.7,baseYaw:root.rotation.y});
  });
  console.info('[world] bridge audience ready',{count:this.spectators.length,species:['rabbit','bear','fox']});
 }
 setGeneratedAssets(assets:GeneratedAssets,only?:readonly ModelId[]){
  const ids:ModelId[]=['audience-white-rabbit','audience-bear','audience-fox','audience-gray-rabbit'];
  this.spectators.forEach((animal,i)=>{const id=ids[i];if(!assets.has(id)||(only&&!only.includes(id)))return;
   const rabbit=id.includes('rabbit'),height=rabbit?2.8:2.5,neck=rabbit?1.35:1.42;
   const {mesh,bones}=assets.rig(id,{height},[new THREE.Vector3(0,neck,0),new THREE.Vector3(-.36,1.1,0),new THREE.Vector3(.36,1.1,0)],p=>{
    const head=THREE.MathUtils.smoothstep(p.y,neck-.12,neck+.12),arm=(1-head)*THREE.MathUtils.smoothstep(Math.abs(p.x),.30,.48)*THREE.MathUtils.smoothstep(p.y,.45,.8);return [1-head-arm,head,p.x<0?arm:0,p.x>=0?arm:0];
   });
   animal.root.clear();animal.root.add(mesh);animal.head=bones[1];animal.head.name=`spectator-gaze-${i}`;animal.arms=[bones[2],bones[3]];animal.pupils=[];
  });
  console.info('[assets] audience visuals replaced',{count:this.spectators.length});
 }
 get diagnostics(){return this.director.viewers.map((v,i)=>({viewer:i,target:v.target,action:v.action}));}
 update(time:number,race:Race,reducedMotion=false){
  const clock=race.state==='ready'?time:race.floatTime,snap=this.generation!==race.generation||this.lastClock<0;
  const dt=snap?0:Math.max(0,Math.min(.1,clock-this.lastClock));this.generation=race.generation;this.lastClock=clock;
  this.director.update(race);
  const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
  this.spectators.forEach((animal,i)=>{
   const behavior=this.director.viewers[i],duck=race.ducks.find(d=>d.id===behavior.target),age=Math.max(0,race.floatTime-behavior.actionAt),phase=age*behavior.speed+i*.61;
   const active=behavior.action!=='watch',envelope=active?Math.min(1,age/.2,Math.max(0,(behavior.until-race.floatTime)/.35)):0;
   const ease=snap?1:1-Math.exp(-dt*([3.7,2.1,4.8,2.8][i]));
   let headYaw=0,headPitch=0;
   if(duck){
    const p=world(duck.s,duck.lane);this.targetPosition.set(p.x,duck.y+1,p.z);animal.root.parent!.worldToLocal(this.targetPosition);
    const dx=this.targetPosition.x-animal.root.position.x,dz=this.targetPosition.z-animal.root.position.z,dy=this.targetPosition.y-(animal.y+1.66*.87);
    const bearing=Math.atan2(dx,dz),offset=wrap(bearing-animal.baseYaw),bodyYaw=animal.baseYaw+Math.sign(offset)*Math.max(0,Math.abs(offset)-.55);
    animal.root.rotation.y+=wrap(bodyYaw-animal.root.rotation.y)*(snap?1:1-Math.exp(-dt*(1.5+i*.2)));
    headYaw=THREE.MathUtils.clamp(wrap(bearing-animal.root.rotation.y),-1.15,1.15);headPitch=THREE.MathUtils.clamp(-Math.atan2(dy,Math.hypot(dx,dz)),-.45,.4);
   }else if(!reducedMotion){headYaw=Math.sin(clock*(.23+i*.04)+animal.phase)*.16;}
   animal.head.rotation.y+=(headYaw-animal.head.rotation.y)*ease;animal.head.rotation.x+=(headPitch-animal.head.rotation.x)*ease;
   animal.head.rotation.z=reducedMotion?0:(behavior.action==='clap'?Math.sin(phase*.5)*.06*envelope:Math.sin(clock*.8+animal.phase)*.018);
   animal.pupils.forEach((pupil,k)=>{pupil.position.x=(k===0?-1:1)*.22+THREE.MathUtils.clamp(headYaw-animal.head.rotation.y,-.6,.6)*.035;pupil.position.y=.08-THREE.MathUtils.clamp(headPitch-animal.head.rotation.x,-.4,.4)*.035;});
   const hop=behavior.action==='hop'&&!reducedMotion?Math.max(0,Math.sin(phase))*.32*envelope:0;
   animal.root.position.y=animal.y+hop;animal.root.rotation.z=reducedMotion?0:(behavior.action==='both'?Math.sin(phase*.55)*.055*envelope:0);
   animal.arms.forEach((arm,k)=>{
    const side=k===0?-1:1;let z=side*.16,x=0,y=0;
    if(!reducedMotion&&behavior.action==='clap'){
     const clap=(Math.sin(phase)+1)*.5;z=side*(.9+clap*.35)*envelope;x=-1.05*envelope;y=-side*(.65+clap*.45)*envelope;
    }else if(behavior.action==='wave'&&k===i%2){z=side*(.16+(2.3+Math.sin(phase)*.38)*envelope);x=reducedMotion?0:Math.sin(phase*.7)*.2*envelope;}
    else if(behavior.action==='hop'||behavior.action==='both')z=side*(.16+(2.1+(reducedMotion?0:Math.sin(phase+k*1.1)*.25))*envelope);
    arm.rotation.set(x,y,z);
   });
  });
 }
}
