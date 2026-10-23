import {bankWidth,flow,obstacles,blockers} from './track';
import {RAPIDS} from './tuning';
type Racer={s:number;lane:number;v:number;id:number};
const clamp=(v:number,n:number)=>Math.max(-n,Math.min(n,v));
/** Reference-style target lateral velocity + damped response. No longitudinal input. */
export function paddleTarget(d:Racer,time:number,axis:number|null){
 const left=bankWidth(d.s,1)-.8,right=bankWidth(d.s,-1)-.8;
 if(axis!==null){
  const clearance=(axis>0?left-d.lane:right+d.lane);
  return axis*RAPIDS.steerMax*Math.max(.15,Math.min(1,clearance/1.5));
 }
 const look=Math.max(7,Math.min(26,d.v*.85));let best=d.lane,score=-Infinity;
 for(const fraction of [-.72,-.36,0,.36,.72]){
  const lane=fraction*(fraction>=0?left:right);
  let value=flow(d.s+look,lane,time)*.12-Math.abs(lane-d.lane)*.18-Math.abs(lane-Math.sin(time*.4+d.id*2.3)*left*.5)*.12;
  for(const b of blockers)if(b.s>d.s-2&&b.s<d.s+look&&Math.abs(lane-b.lane)<b.radius+1)value-=12;
  for(const o of obstacles)if(o.kind==='pendulum'&&o.s>d.s&&o.s<d.s+look){const future=time+(o.s-d.s)/Math.max(3,d.v);if(Math.abs(lane-Math.sin(future*1.8)*2.8)<2)value-=7;}
  if(value>score){score=value;best=lane;}
 }
 return clamp((best-d.lane)*1.8,RAPIDS.steerMax)+Math.sin(time*1.7+d.id*2)*.35;
}
