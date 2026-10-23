import {paddleTarget} from './rapids-physics';
import {FEEL,RAPIDS} from './tuning';
import {TRACK_LENGTH,RUNOUT_LENGTH,flow,width,obstacles,sample,launchVelocity,FLOW_MULTIPLIER,bankWidth,blockers,TRACK_SEED,MOUNTAIN_COURSE} from './track';
import {createMotion,stepMotion,contactImpulse,type Motion} from './dynamics';
import {TrafficCone} from './traffic-cone';
export {COLORS} from './duck-palette';
export const NAMES=[['蛋黄','Sunny'],['桃桃','Peaches'],['蓝莓','Blueberry'],['薄荷','Mint'],['橘子','Mango'],['泡泡','Bubbles'],['青柠','Lime'],['葡萄','Grape'],['奶油','Cream'],['珊瑚','Coral'],['海盐','Sea Salt'],['可可','Cocoa']];
export interface Duck extends Motion {id:number;s:number;lane:number;v:number;lv:number;finish:number|null;hits:number;cooldown:number;stuckTime:number;recoveries:number;progressS:number;}
export interface PhysicsEvent {seq:number;kind:'takeoff'|'landing'|'contact';duck:number;s:number;lane:number;y:number;time:number;strength:number;source?:string;}
export type RaceState='ready'|'countdown'|'racing'|'paused'|'finished';
export class Race {
 readonly cone=new TrafficCone();
 ducks:Duck[]=[];state:RaceState='ready';time=0;countdown=3;results:Duck[]=[];seed:number;previous:RaceState='racing';
 controlled=false;steering={duck:-1,axis:0};
 events:PhysicsEvent[]=[];generation=0;floatTime=0;private seq=0;
 constructor(count=6,seed=42){this.seed=seed;this.reset(count,seed)}
 reset(count:number,seed=Date.now()){
  if(!Number.isInteger(count)||count<2||count>12)throw new RangeError('Duck count must be 2–12');
  this.seed=seed>>>0;this.time=0;this.floatTime=0;this.countdown=3;this.results=[];this.events=[];this.seq=0;this.generation++;this.state='ready';
  this.controlled=false;this.steering={duck:-1,axis:0};this.cone.reset();
  let rng=this.seed;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const slots=Array.from({length:count},(_,i)=>i);
  for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
  this.ducks=slots.map((slot,id)=>{const s=1.3+Math.floor(slot/3)*1.45,lane=(slot%3-1)*1.6;return {id,s,lane,v:0,lv:0,finish:null,hits:0,cooldown:0,stuckTime:0,recoveries:0,progressS:s,...createMotion(s,lane)};});
  console.info('[race] reset',{count,seed:this.seed,trackSeed:TRACK_SEED,mountain:MOUNTAIN_COURSE});
 }
 /** Input is lateral only, clamped at the simulation boundary. */
 setSteering(duck:number,axis:number){this.steering={duck,axis:Number.isFinite(axis)?Math.max(-1,Math.min(1,axis)):0};}
 start(){if(this.state==='ready')this.state='countdown'}
 pause(){if(this.state==='racing'||this.state==='countdown'){this.previous=this.state;this.state='paused'}else if(this.state==='paused')this.state=this.previous;}
 private emit(d:Duck,kind:PhysicsEvent['kind'],strength:number,source?:string){
  this.events.push({seq:++this.seq,kind,duck:d.id,s:d.s,lane:d.lane,y:d.y,time:this.time,strength,...(source?{source}:{})});
  if(this.events.length>256)this.events.shift();
  console.debug('[physics]',kind,{duck:d.id,strength,time:this.time});
 }
 private obstacleContact(d:Duck){
  if(d.cooldown>0)return;
  const cone=this.cone,ds=d.s-cone.s,dl=d.lane-cone.lane,r=Math.hypot(ds,dl);
  if(cone.upright&&r<cone.radius&&Math.abs(d.y-sample(cone.s).y)<1.3){
   const ns=r>.001?ds/r:-1,nl=r>.001?dl/r:0,relative=d.v*ns+d.lv*nl;
   if(relative<-.2){
    const impulse=Math.min(1.8,-relative*.32);
    cone.knock(d.v,d.lv);contactImpulse(d,ns*impulse,nl*impulse);
    this.registerContact(d,impulse);console.debug('[physics] traffic cone knocked down',{duck:d.id,time:this.time});return;
   }
  }
  for(const b of blockers){
   const ds=d.s-b.s,dl=d.lane-b.lane;
   if(d.airborne||Math.abs(ds)>b.length/2+.6||Math.abs(dl)>b.radius+.6)continue;
   const side=Math.sign(dl||((d.id%2)*2-1));
   contactImpulse(d,-Math.max(0,d.v)*.55,side*1.7);
   this.registerContact(d,1.7);return;
  }
  for(const o of obstacles){
   if(Math.abs(d.s-o.s)>4||o.kind==='fan')continue;
   if(o.kind==='bars'){
    const height=.7+(1-Math.sin(this.time*1.5))*1.3;
    if(d.y+1.65<sample(o.s).y+height-.17)continue;
    for(const offset of [-.75,.75]){const ds=d.s-o.s-offset;
     if(Math.abs(ds)<.7&&d.v>0&&ds<.3){const impulse=-(1.38*d.v);contactImpulse(d,impulse,Math.sign(d.lane||1)*.7,.6);d.s=Math.min(d.s,o.s+offset-.7);this.registerContact(d,Math.abs(impulse));return;}
    }
   }else{
    const wheel=o.kind==='wheel'||o.kind==='windmill';
    const parts=wheel?4:1;
    for(let i=0;i<parts;i++){
     const angle=this.time*.9+i*Math.PI/2;
     const lane=o.kind==='pendulum'?Math.sin(this.time*1.8)*2.8:-Math.sin(angle)*2.6;
     const along=o.s+(wheel?Math.cos(angle)*2.6:0);
     const speedL=o.kind==='pendulum'?Math.cos(this.time*1.8)*5.04:-Math.cos(angle)*2.34;
     const speedS=wheel?-Math.sin(angle)*2.34:0;
     const top=sample(o.s).y+(wheel?1.85:3.2);if(d.y>top)continue;
     const ds=d.s-along,dl=d.lane-lane,r=Math.hypot(ds,dl),radius=wheel?1.18:1.73;
     if(r>=radius)continue;
     const ns=r>.001?ds/r:-1,nl=r>.001?dl/r:0;
     const relative=(d.v-speedS)*ns+(d.lv-speedL)*nl;
     if(relative>=0)continue;
     const impulse=Math.min(8,-relative*(wheel?1.15:1.45));
     contactImpulse(d,ns*impulse,nl*impulse,Math.min(1.4,impulse*.15));
     const correction=Math.min(.45,radius-r+.02);d.s+=ns*correction;d.lane+=nl*correction;
     this.registerContact(d,impulse,o.kind);return;
    }
   }
  }
 }
 private registerContact(d:Duck,strength:number,source?:string){d.cooldown=.35;d.hits++;this.emit(d,'contact',strength,source);}
 step(dt:number){
  if(!(dt>0)||dt>.051)throw new RangeError('Use a fixed simulation step <= 50 ms');
  if(this.state==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.state='racing';for(const d of this.ducks)d.v=launchVelocity(d.lane);console.info('[race] started',{seed:this.seed,flowMultiplier:FLOW_MULTIPLIER,launchAssisted:this.ducks.filter(d=>d.v>0).length});}return;}
  if(this.state!=='racing'&&this.state!=='finished')return;
  this.floatTime+=dt;
  this.cone.step(dt,this.ducks.some(d=>Math.hypot(d.s-this.cone.s,d.lane-this.cone.lane)<2.3&&Math.abs(d.y-sample(this.cone.s).y)<2));
  for(const d of this.ducks)if(d.finish!==null)this.drift(d,dt);
  if(this.state==='finished')return;
  this.time+=dt;if(this.steering.axis&&this.ducks.some(d=>d.id===this.steering.duck&&d.finish===null&&!d.airborne))this.controlled=true;
  const previousS=this.ducks.map(d=>d.s);
  for(const d of this.ducks){
   if(d.finish!==null)continue;d.cooldown=Math.max(0,d.cooldown-dt);
   // Passive advection: only submerged ducks receive water drag. Airborne ducks
   // retain horizontal momentum; there is no propulsion or catch-up compensation.
   if(!d.airborne){
    const drag=MOUNTAIN_COURSE?RAPIDS.waterDrag:FEEL.waterDrag;
    d.v+=(flow(d.s,d.lane,this.time)-d.v)*(MOUNTAIN_COURSE?1-Math.exp(-drag*dt):drag*dt);
    if(MOUNTAIN_COURSE){const target=paddleTarget(d,this.time,this.steering.duck===d.id?this.steering.axis:null);d.lv+=(target-d.lv)*(1-Math.exp(-RAPIDS.lateralDrag*dt));}
    else {d.lv+=(Math.sin(d.s*.19+this.time*.9)*.8-d.lane*.14-d.lv*FEEL.lateralDrag)*dt;d.lv+=(this.steering.duck===d.id?this.steering.axis*FEEL.steerAcceleration:0)*dt;}
   }
   this.obstacleContact(d);
   // Detect lack of forward progress, including fast back-and-forth collisions.
   if(d.airborne||d.s>d.progressS+.8){d.progressS=d.s;d.stuckTime=0;}else d.stuckTime+=dt;
   if(d.stuckTime>FEEL.stuckSeconds){
    const obstacle=blockers.find(b=>Math.abs(d.s-b.s)<b.length/2+2);
    const direction=obstacle?Math.sign(d.lane-obstacle.lane||1):-Math.sign(d.lane||1);
    d.lv+=direction*FEEL.escapeImpulse;d.stuckTime=0;d.recoveries++;
    // Metrics hook: count recoveries by track seed/obstacle, never participant names.
    console.warn('[physics] lateral recovery',{duck:d.id,s:d.s,trackSeed:TRACK_SEED,recoveries:d.recoveries});
   }
  }
  for(let i=0;i<this.ducks.length;i++)for(let j=i+1;j<this.ducks.length;j++){
   const a=this.ducks[i],b=this.ducks[j];if(a.finish!==null||b.finish!==null||Math.abs(a.y-b.y)>1.1)continue;
   const ds=a.s-b.s,dl=a.lane-b.lane,r=Math.hypot(ds,dl);if(r>=2.1)continue;
   const ns=r>.001?ds/r:0,nl=r>.001?dl/r:1;
   const repulsion=(2.1-r)*(MOUNTAIN_COURSE?RAPIDS.repelStrength:FEEL.repulsion)*dt,along=MOUNTAIN_COURSE?RAPIDS.repelAlong:1;a.v+=ns*repulsion*along;b.v-=ns*repulsion*along;a.lv+=nl*repulsion;b.lv-=nl*repulsion;
   const relative=(a.v-b.v)*ns+(a.lv-b.lv)*nl;
   if(r<1.32&&relative<-.2){const j=-(1+.42)*relative*.5;contactImpulse(a,ns*j,nl*j);contactImpulse(b,-ns*j,-nl*j);if(j>1&&a.cooldown===0){this.registerContact(a,j);this.registerContact(b,j);}}
  }
  const crossed:Duck[]=[];
  for(const d of this.ducks){
   if(d.finish!==null)continue;
   // Rebound can briefly reverse motion. Its energy then dissipates through water drag.
   d.v=Math.max(-4,Math.min(MOUNTAIN_COURSE?32:12,d.v));d.lv=Math.max(-7,Math.min(7,d.lv));
   d.s=Math.max(0,d.s+d.v*dt);d.lane+=d.lv*dt;
   const edge=bankWidth(d.s,d.lane)-.65;
   if(Math.abs(d.lane)>edge){const side=Math.sign(d.lane);d.lane=side*edge;if(d.lv*side>0){const j=-d.lv*(1+(MOUNTAIN_COURSE?RAPIDS.wallRestitution:.5));contactImpulse(d,-Math.abs(d.v)*(MOUNTAIN_COURSE?1-RAPIDS.wallPenalty:.08),j);if(Math.abs(j)>1.8&&d.cooldown===0)this.registerContact(d,Math.abs(j));}}
   const motion=stepMotion(d,previousS[d.id],this.time,dt);if(motion)this.emit(d,motion.kind,motion.strength);
   if(d.s>=TRACK_LENGTH-2){d.finish=this.time-dt+dt*((TRACK_LENGTH-2-previousS[d.id])/Math.max(.0001,d.s-previousS[d.id]));crossed.push(d);}
  }
  crossed.sort((a,b)=>a.finish!-b.finish!||a.id-b.id);
  for(const d of crossed){this.results.push(d);console.info('[race] finish',{duck:d.id,place:this.results.length,time:d.finish,landings:d.landings,hits:d.hits});}
  if(this.results.length===this.ducks.length){this.state='finished';console.info('[race] complete',{duration:this.time});}
  // Telemetry integration point: race duration, impacts, flight/landing counts and energy.
 }
 /** Finished racers keep floating, without advancing the official race clock or results. */
 private drift(d:Duck,dt:number){
  const oldS=d.s,remaining=Math.max(0,TRACK_LENGTH+RUNOUT_LENGTH-d.s);
  const current=.65+1.8*Math.exp(-Math.max(0,d.s-TRACK_LENGTH)/8);
  d.v+=(Math.min(current,remaining*.25)-d.v)*1.4*dt;
  d.s=Math.min(TRACK_LENGTH+RUNOUT_LENGTH,d.s+Math.max(0,d.v)*dt);
  // Gentle lake eddies and local separation keep drifting finishers from piling up.
  for(const other of this.ducks){if(other===d||other.finish===null)continue;const ds=d.s-other.s,dl=d.lane-other.lane,r=Math.hypot(ds,dl);if(r>0&&r<2.3){d.v+=ds/r*(2.3-r)*dt;d.lv+=dl/r*(2.3-r)*dt;}}
  d.lv+=(Math.sin(this.floatTime*.3+d.s*.2)*.16+d.lane*.035-d.lv)*dt;
  d.lane=Math.max(-16,Math.min(16,d.lane+d.lv*dt));
  stepMotion(d,oldS,this.floatTime,dt);
 }
 ranking(){return [...this.ducks].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.s-a.s)}
}
