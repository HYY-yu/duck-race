import {mountainAnchors} from './mountain-course';
import {FEEL,RAPIDS} from './tuning';
import {resolveTrack} from './track-navigation';
// Each page loads one of the two immutable course profiles.
const params=typeof location!=='undefined'?new URLSearchParams(location.search):new URLSearchParams({track:process.env.DUCK_TRACK??'long',seed:process.env.DUCK_SEED??'42'});
export const MOUNTAIN_COURSE=resolveTrack(params.get('track'))==='mountain';
export const TRACK_SEED=Number(params.get('seed')??42)>>>0;
export const LONG_COURSE=!MOUNTAIN_COURSE;
export const COURSE_SCALE=MOUNTAIN_COURSE?2.4:2.15;
// Pinewood Valley keeps a gentler current; Snowpeak Rapids retains its own pace.
export const FLOW_MULTIPLIER=LONG_COURSE?1.10:1;
export const SLIDE={start:96*2.15,end:110*2.15};
export const RAINBOWS=LONG_COURSE?[25*COURSE_SCALE,145*COURSE_SCALE]:[];
export const WINDMILL_S=176*COURSE_SCALE;
export type Point = {x:number;y:number;z:number};
const anchors:Point[] = (MOUNTAIN_COURSE?mountainAnchors(TRACK_SEED):[
{x:0,y:29,z:-39},{x:14,y:28,z:-34},{x:23,y:25,z:-23},{x:15,y:22,z:-13},{x:-6,y:21,z:-16},{x:-23,y:17,z:-8},{x:-21,y:15,z:2},{x:-7,y:12,z:9},{x:13,y:11,z:8},{x:25,y:8,z:19},{x:14,y:5,z:29},{x:-4,y:3,z:28},{x:-15,y:2,z:38}
]).map(p=>({...p,x:p.x*COURSE_SCALE,z:p.z*COURSE_SCALE}));
function cubic(a:number,b:number,c:number,d:number,t:number){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)}
const raw:Point[]=[];
for(let i=0;i<=700;i++){const u=i/700*(anchors.length-1),j=Math.min(anchors.length-2,Math.floor(u)),t=u-j;const a=anchors[Math.max(0,j-1)],b=anchors[j],c=anchors[j+1],d=anchors[Math.min(anchors.length-1,j+2)];raw.push({x:cubic(a.x,b.x,c.x,d.x,t),y:cubic(a.y,b.y,c.y,d.y,t),z:cubic(a.z,b.z,c.z,d.z,t)});}
const lengths=[0];for(let i=1;i<raw.length;i++) lengths.push(lengths[i-1]+Math.hypot(raw[i].x-raw[i-1].x,raw[i].z-raw[i-1].z));
export const TRACK_LENGTH=lengths.at(-1)!;
export const BASE_TRACK_LENGTH=TRACK_LENGTH/COURSE_SCALE;
export const LAKE_LEVEL=1.65;
export const RUNOUT_LENGTH=32;
export function sample(s:number):Point & {tx:number;tz:number;width:number}{if(s>TRACK_LENGTH){const end=sample(TRACK_LENGTH),distance=s-TRACK_LENGTH,t=1-Math.exp(-distance/4);return {...end,x:end.x+end.tx*distance,z:end.z+end.tz*distance,y:end.y+(LAKE_LEVEL-end.y)*t,width:end.width+Math.min(distance*.45,16)};}s=Math.max(0,Math.min(TRACK_LENGTH,s));let lo=0,hi=lengths.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(lengths[m]<s)lo=m;else hi=m}const t=(s-lengths[lo])/(lengths[hi]-lengths[lo]);const a=raw[lo],b=raw[hi];const dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz);const y=a.y+(b.y-a.y)*t;return {x:a.x+dx*t,y:MOUNTAIN_COURSE?mountainHeight(s):10.3+(y-2)*18.7/27-drop(s)+(LONG_COURSE?4*s/TRACK_LENGTH-4*smooth(SLIDE.start,SLIDE.end,s):0)-.35*smooth(TRACK_LENGTH-10,TRACK_LENGTH,s),z:a.z+dz*t,tx:dx/n,tz:dz/n,width:width(s)};}
function smooth(a:number,b:number,x:number){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
// Two short, steep reaches form actual drops in the channel surface.
export const FALLS=MOUNTAIN_COURSE?[{lip:TRACK_LENGTH*.35,impact:TRACK_LENGTH*.35+9,depth:15},{lip:TRACK_LENGTH*.79,impact:TRACK_LENGTH*.79+8,depth:12}]:[{lip:53*COURSE_SCALE,impact:53*COURSE_SCALE+3.2,depth:4.8},{lip:133*COURSE_SCALE,impact:133*COURSE_SCALE+3.2,depth:3.5}] as const;
function mountainHeight(s:number){return LAKE_LEVEL+80*(1-s/TRACK_LENGTH)+27-drop(s);}
function drop(s:number){return FALLS.reduce((h,f)=>h+f.depth*smooth(f.lip,f.lip+(MOUNTAIN_COURSE?2.1:.6),s),0)}
export function inFall(s:number){return FALLS.some(f=>s>f.lip&&s<f.impact)}
export function width(s:number){if(MOUNTAIN_COURSE){const t=s/TRACK_LENGTH;return COURSE_SCALE*(3.8-1.25*Math.exp(-(((t-.46)/.045)**2))+2.3*Math.exp(-(((t-.64)/.06)**2))+1.2*Math.exp(-(((t-.39)/.035)**2)));}s/=COURSE_SCALE;return 3.6+1.1*Math.exp(-(((s-77)/10)**2))-1.6*Math.exp(-(((s-94)/9)**2))+.7*Math.sin(s*.053)**2;}
export function world(s:number,lane=0){const p=sample(s);return {x:p.x-p.tz*lane,y:p.y,z:p.z+p.tx*lane};}
export const obstacles=MOUNTAIN_COURSE?[{kind:'pendulum',s:TRACK_LENGTH*.15},{kind:'bars',s:TRACK_LENGTH*.28},{kind:'wheel',s:TRACK_LENGTH*.53},{kind:'fan',s:TRACK_LENGTH*.71},{kind:'pendulum',s:TRACK_LENGTH*.88},{kind:'bars',s:TRACK_LENGTH*.94}] as const:[{kind:'pendulum',s:36*COURSE_SCALE},{kind:'wheel',s:77*COURSE_SCALE},{kind:'bars',s:118*COURSE_SCALE},{kind:'fan',s:157*COURSE_SCALE},...(LONG_COURSE?[{kind:'windmill' as const,s:WINDMILL_S}]:[])] as const;
/** Signed curvature is d(tangent)/ds along the left normal. */
export function curvature(s:number){const a=sample(s-.6),b=sample(s+.6);return (a.tx*b.tz-a.tz*b.tx)/1.2;}
export function bankWidths(s:number):{left:number;right:number}{if(s>TRACK_LENGTH){const b=bankWidths(TRACK_LENGTH),extra=Math.min((s-TRACK_LENGTH)*.45,16);return {left:b.left+extra,right:b.right+extra};}const w=width(s),bend=Math.max(-1,Math.min(1,curvature(s)*18))*FEEL.bendNarrowing;return {left:w*(1-bend),right:w*(1+bend)};}
export function bankWidth(s:number,side:number){const banks=bankWidths(s);return side>=0?banks.left:banks.right;}
export function bankDistance(s:number,lane:number){return bankWidth(s,lane)-Math.abs(lane);}
export const blockers=MOUNTAIN_COURSE?[
 {s:TRACK_LENGTH*.63,lane:-1.7,length:16,radius:2.6,kind:'island'},
 {s:TRACK_LENGTH*.23,lane:5,length:3.8,radius:1.9,kind:'rock'},
 {s:TRACK_LENGTH*.57,lane:-5,length:4.8,radius:2.1,kind:'rock'},
 {s:TRACK_LENGTH*.9,lane:4.8,length:3.6,radius:1.9,kind:'rock'},
]:[];
export function flow(s:number,lane:number,time:number){
 const half=bankWidth(s,lane),slope=Math.max(0,(sample(s).y-sample(s+.5).y)/.5);
 // Every course uses the snowpeak continuity model. Course geometry owns the
 // current; ducks never receive a separate propulsion or rank-based boost.
 let speed=RAPIDS.baseFlow*FLOW_MULTIPLIER*Math.pow(3.8*COURSE_SCALE/half,.3)*(1+Math.min(.6,slope)*.6);
 const island=blockers[0];if(island&&Math.abs(s-island.s)<island.length/2+2){const b=bankWidths(s),gap=lane<island.lane?b.right+island.lane-island.radius:b.left-island.lane-island.radius;speed*=Math.pow(half/Math.max(.8,gap),.45);}
 const fan=obstacles.find(o=>o.kind==='fan');if(fan)speed+=2.2*Math.exp(-(((s-fan.s-3)/5)**2));
 return speed+.16*Math.sin(s*.23+time*.8);
}
