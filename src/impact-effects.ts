import * as THREE from 'three';
import {world,sample,flow} from './track';
import type {Race} from './simulation';
import {ParticleField} from './particles';
type Drop={x:number;y:number;z:number;vx:number;vy:number;vz:number;born:number;life:number;size:number;mist:boolean;gold:boolean};
/** Gameplay emits deterministic contacts/landings; this bounded render-only pool
 * consumes them once. Reset and pause never replay a previous splash. */
export class ImpactEffects {
 private droplets=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff}),720);private dummy=new THREE.Object3D();private tint=new THREE.Color();
 private field=new ParticleField(720);private particles:(Drop|undefined)[]=Array(720);private cursor=0;private lastSeq=0;private generation=-1;private rings:{mesh:THREE.Mesh;crown:THREE.Mesh;born:number;life:number;size:number}[]=[];private ringCursor=0;
 constructor(scene:THREE.Scene){this.droplets.name='impact-water-and-hit-droplets';this.droplets.frustumCulled=false;this.droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.field.object,this.droplets);for(let i=0;i<24;i++){const mesh=new THREE.Mesh(new THREE.RingGeometry(.83,1,48),new THREE.MeshBasicMaterial({color:'#eafff5',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);const crownGeo=new THREE.CylinderGeometry(1,.4,1,28,2,true);const pos=crownGeo.attributes.position;for(let k=0;k<pos.count;k++){const y=pos.getY(k)+.5,angle=Math.atan2(pos.getZ(k),pos.getX(k));pos.setY(k,y*(.72+.28*Math.sin(angle*9.+.3)**2));}crownGeo.computeVertexNormals();const crown=new THREE.Mesh(crownGeo,new THREE.MeshBasicMaterial({color:'#ecfff6',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));crown.visible=false;scene.add(crown);this.rings.push({mesh,crown,born:-99,life:1,size:1});}}
 get diagnostics(){return {active:this.particles.filter(Boolean).length,consumed:this.lastSeq};}
 update(race:Race){
  if(race.generation!==this.generation){this.generation=race.generation;this.lastSeq=0;this.particles.fill(undefined);this.rings.forEach(r=>{r.mesh.visible=false;r.crown.visible=false;});}
  for(const e of race.events){if(e.seq<=this.lastSeq)continue;this.lastSeq=e.seq;if(race.time-e.time>.15)continue;
   const p=world(e.s,e.lane),f=sample(e.s),landing=e.kind==='landing',strength=Math.min(1.8,Math.max(.65,e.strength/7)),gold=e.kind==='contact';const count=landing?110:gold?30:8;
   for(let j=0;j<count;j++){const a=j*2.399963+e.seq*.73,q=((j*37+e.seq*13)%97)/97,mist=landing&&j>62;const horizontal=(2.2+q*4.5)*strength;
    this.particles[this.cursor++%720]={x:p.x,y:Math.max(f.y+.06,e.y+(gold?1.1:.1)),z:p.z,vx:Math.cos(a)*horizontal+f.tx*flow(e.s,e.lane,e.time)*.65,vy:(3.5+q*5.5)*strength,vz:Math.sin(a)*horizontal+f.tz*flow(e.s,e.lane,e.time)*.65,born:e.time,life:mist?1.6:.55+q*.65,size:mist?1.3:gold?.18+q*.18:.3+q*.4,mist,gold};
   }
   if(e.kind!=='takeoff'){const r=this.rings[this.ringCursor++%24];r.mesh.position.set(p.x,f.y+.15,p.z);r.born=e.time;r.life=landing?1.5:1;r.size=strength;r.mesh.visible=true;r.crown.position.copy(r.mesh.position);r.crown.visible=true;}
  }
  for(let i=0;i<720;i++){this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.droplets.setMatrixAt(i,this.dummy.matrix);const p=this.particles[i];if(!p){this.field.set(i,0,0,0,0,0);continue;}const age=race.time-p.born,progress=age/p.life;
   if(progress>=1||progress<0){this.particles[i]=undefined;this.field.set(i,0,0,0,0,0);continue;}
   const y=p.y+(p.mist?.5:p.vy)*age-(p.mist?0:4.905)*age*age;
   this.field.set(i,p.x+p.vx*age*(p.mist?.2:1),y,p.z+p.vz*age*(p.mist?.2:1),p.size*(p.mist?1+progress:1-progress*.4),p.mist?Math.sin(progress*Math.PI)*.2:(1-progress)*.95,p.gold?[1,.72,.18]:[.86,.98,1]);
   if(!p.mist){const radius=p.size*(1-progress*.5)*.25;this.dummy.position.set(p.x+p.vx*age,y,p.z+p.vz*age);this.dummy.rotation.set(age*7,i,age*4);this.dummy.scale.set(radius,radius*(p.gold?1:1.8),radius);this.dummy.updateMatrix();this.droplets.setMatrixAt(i,this.dummy.matrix);this.tint.set(p.gold?'#ffc047':'#e8fbff');this.droplets.setColorAt(i,this.tint);}
  }
  this.droplets.instanceMatrix.needsUpdate=true;if(this.droplets.instanceColor)this.droplets.instanceColor.needsUpdate=true;
  this.field.commit();for(const r of this.rings){if(!r.mesh.visible)continue;const t=(race.time-r.born)/r.life;if(t>1){r.mesh.visible=false;r.crown.visible=false;continue;}r.mesh.scale.setScalar((.5+t*2.7)*r.size);(r.mesh.material as THREE.MeshBasicMaterial).opacity=(1-t)*.8;
   const crest=(race.time-r.born)/.65;r.crown.visible=crest<1;if(crest<1){const radius=(.9+crest*1.6)*r.size;r.crown.scale.set(radius,Math.sin(crest*Math.PI)*r.size*1.2,radius);(r.crown.material as THREE.MeshBasicMaterial).opacity=Math.sin(crest*Math.PI)*.82;}
}
 }
}
