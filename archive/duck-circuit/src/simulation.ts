import { applyContactSpin, applyRotationalDrag, integrateHeading, waterSpinAt } from './duck-rotation.ts';
import {BAR_RADIUS,COUNT,COURSE_LENGTH,FINISH_S,OBSTACLES,PENDULUM_RADIUS,START_S,curvatureAt,flowAt,obstaclePose,sampleCourse,HEADWATER,channelAt,sampleChannel,forkAt,FORKS,type Route,type Current} from './course.ts';

// The course owns every speed change. No rank-based boost or chosen winner.
export const VERSION='sim-0.5.0';
export const FINISH=FINISH_S;
export const RADIUS=.62;
export type Duck={id:number;s:number;lateral:number;vs:number;vl:number;finish:number|null;contacts:number;heading:number;angularVelocity:number;route?:Route;fork?:string;airborne?:boolean;elevation?:number;verticalSpeed?:number;landedAt?:number;entrySpeed?:number;fallPassed?:boolean};
export type Event={type:'contact'|'finish'|'split'|'merge'|'takeoff'|'splash';id:number;obstacle?:string;route?:Route;time:number};
export const REPULSION_RADIUS=2.4;
export function rng(seed:number){let a=seed>>>0;return()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function createDucks(seed:number):Duck[]{
  const random=rng(seed),slots=Array.from({length:COUNT},(_,i)=>i);
  for(let i=COUNT-1;i>0;i--){const j=Math.floor(random()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
  return slots.map((slot,id)=>({id,s:START_S,lateral:(slot-(COUNT-1)/2)*1.7,vs:0,vl:0,heading:Math.atan2(sampleCourse(START_S).tz,sampleCourse(START_S).tx),angularVelocity:0,finish:null,contacts:0,route:'main'}));
}
/** A passive floating body's water drag: still water cannot create propulsion. */
export function applyWaterDrag(duck:Duck,current:Current,dt:number):void{
  const response=1-Math.exp(-1.65*dt);
  duck.vs+=(current.forward-duck.vs)*response;
  duck.vl+=(current.lateral-duck.vl)*response;
}
/** Bind a fork from physical position once; its solid island prevents lane switching. */
function bindChannel(d:Duck):void{
  const fork=forkAt(d.s);
  if(!fork){d.route='main';d.fork=undefined;return;}
  if(d.fork===fork.id&&(d.route==='left'||d.route==='right'))return;
  const chosen=channelAt(d.s,d.lateral);
  d.route=chosen.route;d.fork=fork.id;
}
function constrainBank(d:Duck){
  bindChannel(d);
  const span=sampleChannel(d.s,d.route??'main');
  const low=span.min+RADIUS,high=span.max-RADIUS;
  if(d.lateral>high){d.lateral=high;const before=d.vl;d.vl=Math.min(0,d.vl)*.25;applyContactSpin(d,0,d.vl-before);}
  if(d.lateral<low){d.lateral=low;const before=d.vl;d.vl=Math.max(0,d.vl)*.25;applyContactSpin(d,0,d.vl-before);}
  if(d.s>COURSE_LENGTH-RADIUS){d.s=COURSE_LENGTH-RADIUS;d.vs=Math.min(0,d.vs);}
  if(d.s<RADIUS){d.s=RADIUS;d.vs=Math.max(0,d.vs);}
}
/** Short interactions cannot cross the land between the branches, including island tips. */
export function shareWater(a:Duck,b:Duck):boolean{
  const lo=Math.min(a.s,b.s),hi=Math.max(a.s,b.s);
  for(const fork of FORKS){
    if(hi<fork.start||lo>fork.end)continue;
    const aSide=a.fork===fork.id?a.route:channelAt(Math.max(fork.start,Math.min(fork.end-.001,a.s)),a.lateral).route;
    const bSide=b.fork===fork.id?b.route:channelAt(Math.max(fork.start,Math.min(fork.end-.001,b.s)),b.lateral).route;
    if(aSide!==bSide)return false;
  }
  return true;
}
/** Symmetric, finite, short-range pressure avoids visual clumps without a catch-up force. */
export function applySeparation(ducks:Duck[],dt:number):void{
  for(let i=0;i<ducks.length;i++)for(let j=i+1;j<ducks.length;j++){
    const a=ducks[i],b=ducks[j],ds=b.s-a.s,dl=b.lateral-a.lateral;
    const distance=Math.hypot(ds,dl);
    if(distance>=REPULSION_RADIUS||distance<1e-7||!shareWater(a,b)||Math.abs(duckWaterline(a)-duckWaterline(b))>RADIUS*2)continue;
    const strength=4.2*(1-distance/REPULSION_RADIUS)**2;
    const impulse=Math.min(.06,strength*dt),ns=ds/distance,nl=dl/distance;
    a.vs-=ns*impulse;a.vl-=nl*impulse;b.vs+=ns*impulse;b.vl+=nl*impulse;
  }
}
function contact(d:Duck,time:number,obstacle:string,events:Event[]){
  // A constraint may be solved several times per step; report one contact sample.
  if(events.some(event=>event.type==='contact'&&event.id===d.id&&event.obstacle===obstacle))return;
  d.contacts++;events.push({type:'contact',id:d.id,obstacle,time});
}
function collideObstacles(d:Duck,time:number,events:Event[],previousS:number){
  for(const obstacle of OBSTACLES){
    if(Math.abs(d.s-obstacle.s)>2.5)continue;
    const pose=obstaclePose(obstacle,time);
    if(obstacle.kind==='bar'){
      // Duck colliders occupy the waterline through 1.05 units above it.
      if(pose.height-BAR_RADIUS>1.05)continue;
      const reach=RADIUS+BAR_RADIUS,delta=d.s-obstacle.s;
      if(Math.abs(delta)>=reach)continue;
      const side=previousS<obstacle.s?-1:1;
      d.s=obstacle.s+side*reach;
      if(d.vs*side<0){const before=d.vs;d.vs=-d.vs*.12;applyContactSpin(d,d.vs-before,0);}
      contact(d,time,obstacle.id,events);
      continue;
    }
    // Sphere cross-section at the duck's body height, shared with its rendered pose.
    const vertical=pose.height-.5;
    const radius=PENDULUM_RADIUS+RADIUS;
    if(Math.abs(vertical)>=radius)continue;
    const horizontalRadius=Math.sqrt(radius*radius-vertical*vertical);
    const ds=d.s-obstacle.s,dl=d.lateral-pose.lateral,distance=Math.hypot(ds,dl);
    if(distance>=horizontalRadius)continue;
    const ns=distance>1e-6?ds/distance:-1,nl=distance>1e-6?dl/distance:0;
    const penetration=horizontalRadius-distance;
    d.s+=ns*penetration;d.lateral+=nl*penetration;
    const nextPose=obstaclePose(obstacle,time+.001);
    const obstacleV=(nextPose.lateral-pose.lateral)/.001;
    const into=d.vs*ns+(d.vl-obstacleV)*nl;
    if(into<0){d.vs-=into*ns*1.25;d.vl-=into*nl*1.25;applyContactSpin(d,-into*ns*1.25,-into*nl*1.25);}
    contact(d,time,obstacle.id,events);
  }
}
/** Height is owned by the fixed simulation while airborne, never a camera animation. */
export function duckWaterline(d:Duck):number {return d.airborne&&d.elevation!==undefined?d.elevation:sampleChannel(d.s,d.route??'main').y+.035;}
export function landingOffset(d:Duck,time:number):number {
  const age=d.landedAt===undefined?Infinity:time-d.landedAt;
  return age>=0&&age<1.4?-Math.min(.34,(d.entrySpeed??0)*.024)*Math.exp(-age*3.3)*Math.sin(age*10):0;
}
/** Fixed-step integration in channel coordinates. No racer has an engine or target speed. */
export function step(ducks:Duck[],time:number,dt:number):Event[]{
  if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw new RangeError('Simulation dt must be positive and at most 1/30 second.');
  if(!Number.isFinite(time))throw new RangeError('Simulation time must be finite.');
  const events:Event[]=[];
  const previous=new Map<number,number>();
  const previousChannel=new Map<number,{fork?:string;route?:Route}>();
  for(const d of ducks){bindChannel(d);previousChannel.set(d.id,{fork:d.fork,route:d.route});}
  applySeparation(ducks,dt);
  for(const d of ducks){
    previous.set(d.id,d.s);
    if(!d.airborne) {
      applyWaterDrag(d,flowAt(d.s,d.lateral,time),dt);
      applyRotationalDrag(d,waterSpinAt(d,time),dt);
    }
    // Curved lanes have different physical lengths; this creates visible inside-line passes.
    const metric=Math.max(.65,Math.min(1.35,1-curvatureAt(d.s)*d.lateral));
    d.s+=d.vs*dt/metric;d.lateral+=d.vl*dt;
    if(!d.fallPassed&&!d.airborne&&previous.get(d.id)!<=HEADWATER.lip&&d.s>HEADWATER.lip) {
      d.airborne=true; d.fallPassed=true;
      d.elevation=sampleChannel(HEADWATER.lip,'main').y+.035;
      d.verticalSpeed=-.048*d.vs;
      events.push({type:'takeoff',id:d.id,time,obstacle:'headwater-drop'});
    }
    if(d.airborne) {
      // Exact constant-gravity displacement at 120 Hz, with no artificial forward kick.
      d.elevation!+=d.verticalSpeed!*dt-.5*HEADWATER.gravity*dt*dt;
      d.verticalSpeed!-=HEADWATER.gravity*dt;
      const surface=sampleChannel(d.s,'main').y+.035;
      if(d.s>HEADWATER.lip+1.1&&d.elevation!<=surface) {
        d.entrySpeed=-d.verticalSpeed!;d.landedAt=time;d.airborne=false;d.elevation=surface;
        events.push({type:'splash',id:d.id,time,obstacle:'headwater-drop'});
      }
    }
    constrainBank(d);
    collideObstacles(d,time,events,previous.get(d.id)!);
  }
  // Equal-mass separation prevents overtaking through another duck.
  // Multiple constraint iterations keep a queue within both banks in the narrow chute.
  for(let iteration=0;iteration<8;iteration++){
    for(let i=0;i<ducks.length;i++)for(let j=i+1;j<ducks.length;j++){
      const a=ducks[i],b=ducks[j];
      const ds=b.s-a.s,dl=b.lateral-a.lateral,distance=Math.hypot(ds,dl),overlap=RADIUS*2-distance;
      if(overlap<=0||!shareWater(a,b)||Math.abs(duckWaterline(a)-duckWaterline(b))>RADIUS*2)continue;
      const ns=distance>1e-7?ds/distance:1,nl=distance>1e-7?dl/distance:0;
      a.s-=ns*overlap*.5;a.lateral-=nl*overlap*.5;b.s+=ns*overlap*.5;b.lateral+=nl*overlap*.5;
      const rel=(b.vs-a.vs)*ns+(b.vl-a.vl)*nl;
      if(rel<0){a.vs+=rel*ns*.5;a.vl+=rel*nl*.5;b.vs-=rel*ns*.5;b.vl-=rel*nl*.5;applyContactSpin(a,rel*ns*.5,rel*nl*.5);applyContactSpin(b,-rel*ns*.5,-rel*nl*.5);}
    }
    for(const d of ducks){
      constrainBank(d);
      collideObstacles(d,time,events,previous.get(d.id)!);
    }
  }
  for(const d of ducks){
    const before=previousChannel.get(d.id)!;
    bindChannel(d);
    if(before.fork!==d.fork){
      if(before.fork)events.push({type:'merge',id:d.id,obstacle:before.fork,route:before.route,time});
      if(d.fork)events.push({type:'split',id:d.id,obstacle:d.fork,route:d.route,time});
    }
    integrateHeading(d,dt);
    if(d.finish!==null)continue;
    // Final solid pass stops a packed queue from pushing another racer through a closed bar.
    collideObstacles(d,time,events,previous.get(d.id)!);
    constrainBank(d);
    if(d.s>=FINISH){
      const old=previous.get(d.id)!;
      const fraction=Math.max(0,Math.min(1,(FINISH-old)/Math.max(1e-8,d.s-old)));
      d.finish=Math.max(0,time-dt+fraction*dt);
      // Finish records the crossing; water keeps carrying the duck into the run-out pool.
      events.push({type:'finish',id:d.id,time:d.finish});
    }
  }
  return events;
}
export function getStandings(ducks:Duck[]):Duck[]{
  return [...ducks].sort((a,b)=>{
    if(a.finish!==null&&b.finish!==null)return a.finish-b.finish||a.id-b.id;
    if(a.finish!==null)return -1;if(b.finish!==null)return 1;
    return b.s-a.s||a.id-b.id;
  });
}
