export type Point = {x:number;y:number;z:number};
const anchors:Point[] = [
{x:0,y:29,z:-39},{x:14,y:28,z:-34},{x:23,y:25,z:-23},{x:15,y:22,z:-13},{x:-6,y:21,z:-16},{x:-23,y:17,z:-8},{x:-21,y:15,z:2},{x:-7,y:12,z:9},{x:13,y:11,z:8},{x:25,y:8,z:19},{x:14,y:5,z:29},{x:-4,y:3,z:28},{x:-15,y:2,z:38}
];
function cubic(a:number,b:number,c:number,d:number,t:number){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)}
const raw:Point[]=[];
for(let i=0;i<=700;i++){const u=i/700*(anchors.length-1),j=Math.min(anchors.length-2,Math.floor(u)),t=u-j;const a=anchors[Math.max(0,j-1)],b=anchors[j],c=anchors[j+1],d=anchors[Math.min(anchors.length-1,j+2)];raw.push({x:cubic(a.x,b.x,c.x,d.x,t),y:cubic(a.y,b.y,c.y,d.y,t),z:cubic(a.z,b.z,c.z,d.z,t)});}
const lengths=[0];for(let i=1;i<raw.length;i++) lengths.push(lengths[i-1]+Math.hypot(raw[i].x-raw[i-1].x,raw[i].z-raw[i-1].z));
export const TRACK_LENGTH=lengths.at(-1)!;
export const LAKE_LEVEL=1.65;
export const RUNOUT_LENGTH=32;
export function sample(s:number):Point & {tx:number;tz:number;width:number}{if(s>TRACK_LENGTH){const end=sample(TRACK_LENGTH),distance=s-TRACK_LENGTH,t=1-Math.exp(-distance/4);return {...end,x:end.x+end.tx*distance,z:end.z+end.tz*distance,y:end.y+(LAKE_LEVEL-end.y)*t,width:end.width+Math.min(distance*.45,16)};}s=Math.max(0,Math.min(TRACK_LENGTH,s));let lo=0,hi=lengths.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(lengths[m]<s)lo=m;else hi=m}const t=(s-lengths[lo])/(lengths[hi]-lengths[lo]);const a=raw[lo],b=raw[hi];const dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz);const y=a.y+(b.y-a.y)*t;return {x:a.x+dx*t,y:10.3+(y-2)*18.7/27-drop(s)-.35*smooth(TRACK_LENGTH-10,TRACK_LENGTH,s),z:a.z+dz*t,tx:dx/n,tz:dz/n,width:width(s)};}
function smooth(a:number,b:number,x:number){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
// Two short, steep reaches form actual drops in the channel surface.
export const FALLS=[{lip:53,impact:56.2,depth:4.8},{lip:133,impact:136.2,depth:3.5}] as const;
function drop(s:number){return FALLS.reduce((h,f)=>h+f.depth*smooth(f.lip,f.lip+.6,s),0)}
export function inFall(s:number){return FALLS.some(f=>s>f.lip&&s<f.impact)}
export function width(s:number){return 3.6+1.1*Math.exp(-(((s-77)/10)**2))-1.6*Math.exp(-(((s-94)/9)**2))+.7*Math.sin(s*.053)**2;}
export function world(s:number,lane=0){const p=sample(s);return {x:p.x-p.tz*lane,y:p.y,z:p.z+p.tx*lane};}
export const obstacles=[{kind:'pendulum',s:36},{kind:'wheel',s:77},{kind:'bars',s:118},{kind:'fan',s:157}] as const;
export function flow(s:number,lane:number,time:number){const a=sample(s),b=sample(s+1);const bend=(b.tx*a.tz-b.tz*a.tx);const slope=Math.min(.6,Math.max(0,a.y-b.y));return Math.max(1.5,3.3+slope*4+lane*bend*17+.28*Math.sin(s*.23+time*.8)+(s>150&&s<171?3.8:0));}
