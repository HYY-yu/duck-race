import {COURSE_SCALE} from './track';
export const TRAFFIC_CONE_S=22*COURSE_SCALE;
/** A lightweight anchored course prop: collision and recovery use simulation time. */
export class TrafficCone {
 readonly s=TRAFFIC_CONE_S;readonly lane=0;readonly radius=1.2;
 elapsed:number|null=null;tilt=0;along=1;lateral=0;
 get upright(){return this.elapsed===null;}
 reset(){this.elapsed=null;this.tilt=0;this.along=1;this.lateral=0;}
 knock(along:number,lateral:number){
  if(!this.upright)return false;
  const length=Math.hypot(along,lateral)||1;
  this.along=along/length;this.lateral=lateral/length;this.elapsed=0;
  return true;
 }
 step(dt:number,occupied:boolean){
  if(this.elapsed===null)return;
  // Wait for nearby racers to leave before restoring the collider.
  this.elapsed=Math.min(3.6,this.elapsed+dt);
  if(occupied&&this.elapsed>2.8)this.elapsed=2.8;
  const ease=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
  this.tilt=1.48*ease(this.elapsed/.25)*(1-ease((this.elapsed-2.8)/.8));
  if(this.elapsed>=3.6){this.reset();console.debug('[physics] traffic cone restored');}
 }
}
