import * as THREE from 'three';
export type ClearView=(target:THREE.Vector3,position:THREE.Vector3)=>boolean;
type TerrainHeight=(x:number,z:number)=>number;
// All candidates remain behind the racer: avoiding a tree must not reverse the shot.
const poses=[[24,10,23],[24,-10,26],[20,16,32],[20,-16,32],[10,0,42]];
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const lookMatrix=new THREE.Matrix4(),lookRotation=new THREE.Quaternion();
export function stableLookAt(camera:THREE.Camera,target:THREE.Vector3,dt:number,rate=.9){
 lookMatrix.lookAt(camera.position,target,camera.up);lookRotation.setFromRotationMatrix(lookMatrix);
 camera.quaternion.rotateTowards(lookRotation,Math.max(0,dt)*rate);
}
/** A continuous camera rig: bounded velocity/acceleration, persistent routes and
 * delayed obstruction decisions. Brief occlusion never causes a position snap. */
export class FollowCamera {
 constructor(private rapids=false){}
 private slot=0;private hold=0;private probe=0;private blockedFor=0;private lowBlockedFor=0;private clearFor=0;
 private raise=0;private requestedRaise=0;private preview=0;private heading=0;private initialized=false;
 private anchor=new THREE.Vector3();private candidate=new THREE.Vector3();
 private velocity=new THREE.Vector3();private desiredVelocity=new THREE.Vector3();private acceleration=new THREE.Vector3();private next=new THREE.Vector3();
 readonly goal=new THREE.Vector3();avoided=false;clear=true;routeChanges=0;lastStep=0;
 reset(){this.slot=0;this.hold=0;this.probe=0;this.blockedFor=0;this.lowBlockedFor=0;this.clearFor=0;this.raise=0;this.requestedRaise=0;this.preview=0;this.initialized=false;this.velocity.set(0,0,0);this.routeChanges=0;}
 /** Shared by follow and arrival views, so finishing cannot introduce a fast cut. */
 moveTo(camera:THREE.Camera,goal:THREE.Vector3,dt:number,terrainHeight?:TerrainHeight){
  dt=Math.max(0,Math.min(.1,dt));if(dt===0)return;
  const distance=camera.position.distanceTo(goal);this.desiredVelocity.subVectors(goal,camera.position).clampLength(0,Math.min(this.rapids?90:26,distance*(this.rapids?6:2.2),Math.sqrt((this.rapids?240:24)*distance)));
  this.desiredVelocity.y=THREE.MathUtils.clamp(this.desiredVelocity.y,this.rapids?-45:-10,this.rapids?45:12);
  this.acceleration.subVectors(this.desiredVelocity,this.velocity).clampLength(0,(this.rapids?120:18)*dt);this.velocity.add(this.acceleration);
  this.next.copy(camera.position).addScaledVector(this.velocity,dt);
  // Wait for vertical clearance before crossing a hillside, rather than teleporting above it.
  if(terrainHeight&&this.next.y<terrainHeight(this.next.x,this.next.z)+1.5){this.next.x=camera.position.x;this.next.z=camera.position.z;this.velocity.x*=.8;this.velocity.z*=.8;}
  this.lastStep=camera.position.distanceTo(this.next);camera.position.copy(this.next);
 }
 update(camera:THREE.Camera,target:THREE.Vector3,tx:number,tz:number,dt:number,clearView:ClearView,lift=0,terrainHeight?:TerrainHeight,speed=0){
  dt=Math.max(0,Math.min(.1,dt));const heading=Math.atan2(tx,tz);
  if(!this.initialized){this.anchor.copy(target);this.heading=heading;this.initialized=true;}
  this.anchor.x=THREE.MathUtils.damp(this.anchor.x,target.x,4,dt);this.anchor.z=THREE.MathUtils.damp(this.anchor.z,target.z,4,dt);
  this.anchor.y=THREE.MathUtils.damp(this.anchor.y,target.y,1.8,dt);
  this.heading+=THREE.MathUtils.clamp(wrap(heading-this.heading),-dt*(this.rapids?3.5:.6),dt*(this.rapids?3.5:.6));
  this.preview=THREE.MathUtils.damp(this.preview,lift,1.5,dt);
  const sx=Math.sin(this.heading),sz=Math.cos(this.heading);
  const place=(slot:number,raise:number)=>{const n=Math.min(1.6,speed/20),options=this.rapids?[[8.4+n*3,1,4.4+n*.7],[8.4+n*3,-2,6],[7,4,9],[7,-4,9],[4,0,15]]:poses;const [back,side,height]=options[slot];return this.candidate.set(this.anchor.x-sx*back-sz*side,this.anchor.y+height+this.preview+raise,this.anchor.z-sz*back+sx*side);};
  // Confirm obstruction every frame; coarse probe sampling must not alias flickering foliage.
  const baseClear=clearView(target,place(this.slot,0)),ceilingClear=baseClear||clearView(target,place(this.slot,24));
  this.lowBlockedFor=baseClear?0:this.lowBlockedFor+dt;this.blockedFor=ceilingClear?0:this.blockedFor+dt;this.clearFor=baseClear?this.clearFor+dt:0;
  this.probe-=dt;this.hold=Math.max(0,this.hold-dt);
  if(this.probe<=0){
   this.probe=.25;
   if(baseClear){
    if(this.clearFor>=3)this.requestedRaise=Math.max(0,this.requestedRaise-.4);
   }else if(this.lowBlockedFor>=.4){
    let elevation=-1;
    for(let raise=4;raise<=24;raise+=4)if(clearView(target,place(this.slot,raise))){elevation=raise+2;break;}
    if(elevation>=0){this.requestedRaise=Math.max(this.requestedRaise,elevation);}
    else{
     this.requestedRaise=Math.max(this.requestedRaise,12);
     if(this.blockedFor>=1.25&&this.hold===0){
      const next=poses.findIndex((_,i)=>i!==this.slot&&clearView(target,place(i,this.requestedRaise)));
      if(next>=0){const previous=this.slot;this.slot=next;this.hold=4;this.blockedFor=0;this.routeChanges++;console.debug('[camera] sustained obstruction route',{from:previous,to:next});}
     }
    }
   }
  }
  this.raise+=THREE.MathUtils.clamp(this.requestedRaise-this.raise,-dt*1.2,dt*5);
  this.goal.copy(place(this.slot,this.raise));
  if(terrainHeight)this.goal.y=Math.max(this.goal.y,terrainHeight(this.goal.x,this.goal.z)+3);
  this.moveTo(camera,this.goal,dt,terrainHeight);
  this.clear=clearView(target,camera.position);this.avoided=this.slot!==0||this.raise>.2||!this.clear;
 }
}
