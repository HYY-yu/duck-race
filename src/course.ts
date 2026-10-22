/** Shared geometry and water field. Simulation and rendering sample the same channel. */
export const COUNT = 5;
export const START_S = 4;
export const PENDULUM_RADIUS = .9;
export const BAR_RADIUS = .24;
export type Route = 'main' | 'left' | 'right';
export type CourseFrame = {
  x:number; y:number; z:number;
  tx:number; tz:number; nx:number; nz:number;
  width:number; depth:number; slope:number;
};
/** min/max are lateral offsets from the common centerline, not world coordinates. */
export type ChannelSpan = {route:Route;min:number;max:number;y:number;depth:number;slope:number};
export type Obstacle = {id:string;kind:'pendulum'|'bar';s:number;phase:number};
export type Current = {forward:number;lateral:number};
export type Fork = {id:string;start:number;end:number;peakWidth:number;drop:number;phase:number;inletBias:number;leftShare:number};
export const FORKS:Fork[] = [
  {id:'cedar-island',start:66,end:124,peakWidth:7.4,drop:7,phase:.4,inletBias:0,leftShare:.5},
  {id:'terrace-island',start:211,end:273,peakWidth:8.4,drop:7,phase:2.1,inletBias:.65,leftShare:.57},
];
/** First waterfall prototype: the wetted bed drops behind a free water sheet.
 * Flight is integrated separately; these coordinates never prescribe a duck's landing. */
export const HEADWATER = { lip: 34, impact: 39.5, drop: 9, gravity: 9.81, sheetSpeed: 4.05 };
export const CASCADES = [
  {id:'headwater-drop',start:28,end:HEADWATER.impact,drop:9},
  {id:'narrows-drop',start:176,end:196,drop:11},
  {id:'lower-drop',start:282,end:302,drop:12},
];

const controls = [
  [0,-83],[0,-54],[31,-33],[37,-8],[10,14],[-26,29],
  [-38,56],[-11,75],[21,94],[28,119],[13,140],[-20,150],
];
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const pulse=(s:number,start:number,end:number,ramp:number)=>smooth((s-start)/ramp)*(1-smooth((s-end+ramp)/ramp));
function curve(segment:number,t:number):{x:number;z:number}{
  const a=controls[Math.max(0,segment-1)],b=controls[segment];
  const c=controls[segment+1],d=controls[Math.min(controls.length-1,segment+2)];
  const component=(i:number)=>.5*((2*b[i])+(-a[i]+c[i])*t+(2*a[i]-5*b[i]+4*c[i]-d[i])*t*t+(-a[i]+3*b[i]-3*c[i]+d[i])*t*t*t);
  return {x:component(0),z:component(1)};
}
const centerline:Array<{s:number;x:number;z:number}>=[];
let length=0;
for(let segment=0;segment<controls.length-1;segment++){
  for(let tick=segment===0?0:1;tick<=100;tick++){
    const p=curve(segment,tick/100),previous=centerline.at(-1);
    if(previous)length+=Math.hypot(p.x-previous.x,p.z-previous.z);
    centerline.push({s:length,...p});
  }
}
export const COURSE_LENGTH=length;
export const FINISH_S=COURSE_LENGTH-10;
/** Disjoint navigable ribbons; a fork replaces, rather than overlays, the main reach. */
export const RIVER_REACHES:Array<{start:number;end:number;route:Route}> = [
  {start:0,end:FORKS[0].start,route:'main'},
  {start:FORKS[0].start,end:FORKS[0].end,route:'left'},
  {start:FORKS[0].start,end:FORKS[0].end,route:'right'},
  {start:FORKS[0].end,end:FORKS[1].start,route:'main'},
  {start:FORKS[1].start,end:FORKS[1].end,route:'left'},
  {start:FORKS[1].start,end:FORKS[1].end,route:'right'},
  {start:FORKS[1].end,end:COURSE_LENGTH,route:'main'},
];
export const SECTIONS=[
  {id:'launch',start:0,end:26},
  {id:'cascade',start:26,end:64},
  {id:'fork_one',start:64,end:130},
  {id:'pendulums',start:130,end:174},
  {id:'chute',start:174,end:211},
  {id:'fork_two',start:211,end:278},
  {id:'cascade_two',start:278,end:305},
  {id:'gates',start:305,end:338},
  {id:'finish',start:338,end:COURSE_LENGTH},
];
export const OBSTACLES:Obstacle[]=[
  {id:'pendulum-1',kind:'pendulum',s:140,phase:2.1},
  {id:'pendulum-2',kind:'pendulum',s:160,phase:1.0},
  {id:'bar-1',kind:'bar',s:311,phase:0},
  {id:'bar-2',kind:'bar',s:322,phase:2.2},
  {id:'bar-3',kind:'bar',s:333,phase:4.3},
];
function centerAt(s:number){
  const position=clamp(s,0,COURSE_LENGTH);
  let lo=0,hi=centerline.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(centerline[mid].s<position)lo=mid;else hi=mid;}
  const a=centerline[lo],b=centerline[hi],t=(position-a.s)/(b.s-a.s);
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
}
export function forkAt(s:number):Fork|undefined{return FORKS.find(f=>s>=f.start&&s<f.end);}
const chuteWeight=(s:number)=>pulse(s,172,208,10);
function widthAt(s:number){
  let width=10.8+(1-smooth((s-13)/13))*1.2+smooth((s-337)/17)*2.8-chuteWeight(s)*8.2;
  for(const fork of FORKS)width+=pulse(s,fork.start-14,fork.end+13,18)*8.4;
  for(const drop of CASCADES)width+=pulse(s,drop.end,drop.end+17,6)*2.8;
  // A rocky lip gathers the flow; the plunge pool opens below the sheet.
  width -= pulse(s, 27, 35.5, 4) * 2.4;
  width += pulse(s, 38, 54, 5) * 3.0;
  return width;
}
function heightAt(s:number){
  let y=70-.048*s;
  for(const drop of CASCADES)y-=drop.drop*(drop.id==='headwater-drop'
    ? smooth((s-HEADWATER.lip)/1.1)
    : smooth((s-drop.start)/(drop.end-drop.start)));
  for(const fork of FORKS)y-=fork.drop*smooth((s-fork.start)/(fork.end-fork.start));
  return y;
}
function depthAt(s:number){return 1.04+chuteWeight(s)*.7+pulse(s,35.2,53,4)*1.35;}
export function sampleCourse(s:number):CourseFrame{
  const position=clamp(s,0,COURSE_LENGTH),p=centerAt(position);
  const before=centerAt(position-.2),after=centerAt(position+.2);
  const magnitude=Math.hypot(after.x-before.x,after.z-before.z)||1;
  const tx=(after.x-before.x)/magnitude,tz=(after.z-before.z)/magnitude;
  return {...p,y:heightAt(position),tx,tz,nx:tz,nz:-tx,width:widthAt(position),depth:depthAt(position),slope:(heightAt(position-.05)-heightAt(position+.05))/.1};
}
function branchHeight(s:number,fork:Fork,route:Route):number{
  const t=clamp((s-fork.start)/(fork.end-fork.start),0,1);
  const sign=route==='left'?-1:1;
  // Equal endpoints, different drop timing; derivative stays below the shared downhill slope.
  return heightAt(s)+sign*1.35*Math.sin(Math.PI*t)**2;
}
function spanForFork(s:number,fork:Fork,route:'left'|'right'):ChannelSpan{
  const t=clamp((s-fork.start)/(fork.end-fork.start),0,1),shape=Math.sin(Math.PI*t)**2;
  const width=widthAt(s),islandHalf=fork.peakWidth*.5*shape;
  // The island is offset slightly, giving each branch its own wetted width.
  const offset=Math.sin(Math.PI*t)*.9*Math.sin(t*Math.PI*2+fork.phase);
  const min=route==='left'?-width*.5:offset+islandHalf;
  const max=route==='left'?offset-islandHalf:width*.5;
  const depth=depthAt(s)+(route==='left'?.27:.06)*shape;
  const slope=t<1e-9||t>1-1e-9?sampleCourse(s).slope:(branchHeight(s-.025,fork,route)-branchHeight(s+.025,fork,route))/.05;
  return {route,min,max,y:branchHeight(s,fork,route),depth,slope};
}
export function channelSpans(s:number):ChannelSpan[]{
  const fork=forkAt(s);
  if(fork)return [spanForFork(s,fork,'left'),spanForFork(s,fork,'right')];
  const frame=sampleCourse(s);
  return [{route:'main',min:-frame.width/2,max:frame.width/2,y:frame.y,depth:frame.depth,slope:frame.slope}];
}
/** Call only for a matching RIVER_REACHES route; endpoints share the same water level. */
export function sampleChannel(s:number,route:Route):ChannelSpan{
  if(route!=='main'){
    const fork=FORKS.find(f=>s>=f.start-1e-6&&s<=f.end+1e-6);
    if(fork)return spanForFork(s,fork,route);
  }
  const frame=sampleCourse(s);
  return {route:'main',min:-frame.width/2,max:frame.width/2,y:frame.y,depth:frame.depth,slope:frame.slope};
}
export function channelAt(s:number,lateral:number):ChannelSpan{
  const spans=channelSpans(s);
  if(spans.length===1)return spans[0];
  const divider=(spans[0].max+spans[1].min)/2;
  return lateral<=divider?spans[0]:spans[1];
}
export function sampleSurface(s:number,lateral:number):CourseFrame{
  const frame=sampleCourse(s),channel=channelAt(s,lateral);
  return {...frame,y:channel.y,depth:channel.depth,slope:channel.slope};
}
/** Signed horizontal curvature; positive turns toward the channel's normal. */
export function curvatureAt(s:number):number{
  const a=sampleCourse(s-.4),b=sampleCourse(s+.4),f=sampleCourse(s);
  return ((b.tx-a.tx)*f.nx+(b.tz-a.tz)*f.nz)/.8;
}
/** A stylized discharge field, not a Navier–Stokes / free-surface solver.
 * Each fork divides a shared discharge between two real wetted sections. Its
 * common oscillating splitter changes their advantage without consulting racers.
 * The contraction reduces wetted area despite becoming deeper; slope adds energy.
 */
export function flowAt(s:number,lateral:number,time:number):Current{
  const f=sampleCourse(s),channel=channelAt(s,lateral),fork=forkAt(s);
  const center=(channel.min+channel.max)/2,width=channel.max-channel.min;
  const local=lateral-center,edge=clamp(Math.abs(local)/(width/2),0,1);
  let discharge=36;
  if(fork){
    const leftShare=fork.leftShare+.18*Math.sin(time*.38+fork.phase);
    discharge*=channel.route==='left'?leftShare:1-leftShare;
  }
  const branchSpeed=discharge/(width*channel.depth);
  const junction=fork?Math.min(smooth((s-fork.start)/5),smooth((fork.end-s)/5)):1;
  const mainEdge=clamp(Math.abs(lateral)/(f.width/2),0,1);
  const mainSpeed=36/(f.width*f.depth)*(1-.16*mainEdge*mainEdge);
  const wetSlope=inWaterfallGap(s)?0:Math.min(channel.slope,1.4);
  const forward=mainSpeed*(1-junction)+(branchSpeed*(1-.16*edge*edge)+Math.max(0,wetSlope-.048)*3.7)*junction;
  const spanBefore=fork?spanForFork(s-.12,fork,channel.route as 'left'|'right'):sampleChannel(s-.12,'main');
  const spanAfter=fork?spanForFork(s+.12,fork,channel.route as 'left'|'right'):sampleChannel(s+.12,'main');
  const centerDerivative=((spanAfter.min+spanAfter.max)-(spanBefore.min+spanBefore.max))/.48;
  const widthDerivative=((spanAfter.max-spanAfter.min)-(spanBefore.max-spanBefore.min))/.24;
  const contraction=(centerDerivative+local/width*widthDerivative)*forward;
  const bend=clamp(curvatureAt(s)*forward*.72,-.45,.45);
  const ripple=.18*Math.sin(s*.19+time*.65)*(1-edge);
  let sideways=contraction-bend+ripple-local*.065;
  // A shared oscillating inlet jet spreads successive arrivals around each island tip.
  for(const nextFork of FORKS){
    const inlet=pulse(s,nextFork.start-13,nextFork.start+7,5);
    sideways+=inlet*(nextFork.inletBias+.95*Math.sin(time*1.25+nextFork.phase));
  }
  // A weak return current models the banks redirecting water toward the main channel.
  const terminal=s>FINISH_S?Math.max(0,(COURSE_LENGTH-1-s)/(COURSE_LENGTH-1-FINISH_S)):1;
  return {forward:forward*terminal,lateral:clamp(sideways,-3.5,3.5)};
}
/** Pose is shared with collision checks, so an open bar really is passable. */
export function obstaclePose(obstacle:Obstacle,time:number):{lateral:number;height:number;angle:number}{
  if(obstacle.kind==='pendulum'){
    const angle=Math.sin(time*.98+obstacle.phase)*.86;
    const armLength=4.5;
    return {lateral:Math.sin(angle)*armLength,height:.57+armLength*(1-Math.cos(angle)),angle};
  }
  const lift=smooth((Math.sin(time*1.24+obstacle.phase)+.38)/.7);
  return {lateral:0,height:.22+lift*2.3,angle:0};
}

/** Ignore the virtual inner edge while a fork tip is still opening/closing. */
export function bankDistanceAt(s:number,lateral:number,route:Route='main'):number {
  const span=sampleChannel(s,route),frame=sampleCourse(s);
  const spans=channelSpans(s),gap=spans.length===2?spans[1].min-spans[0].max:0;
  const inner=smooth(gap/1.4);
  const left=route==='right'?inner:1,right=route==='left'?inner:1;
  const dl=(lateral-span.min)*left+(lateral+frame.width/2)*(1-left);
  const dr=(span.max-lateral)*right+(frame.width/2-lateral)*(1-right);
  return Math.max(0,Math.min(dl,dr));
}
/** Only the first fall is a free sheet; other cascades remain wetted rapids. */
export function inWaterfallGap(s:number):boolean {return s>HEADWATER.lip&&s<HEADWATER.impact;}

/** Global longitudinal stations keep adjacent river, bank and terrain edges identical. */
export function riverStations(start:number,end:number,spacing=.35):number[] {
  const values=[start,end];
  for(let i=Math.ceil(start/spacing);i*spacing<end;i++)if(i*spacing>start)values.push(i*spacing);
  for(const s of [HEADWATER.lip,HEADWATER.lip+1.1,HEADWATER.impact,...FORKS.flatMap(f=>[f.start,f.end])])if(s>start&&s<end)values.push(s);
  return [...new Set(values)].sort((a,b)=>a-b);
}
/** Exact shared edge of the rock lip and its terrain shoulder. */
export function bankShoulder(s:number) {
  return {offset:.42+Math.sin(s*2.7)*.05,height:.29+Math.sin(s*1.8)*.055+Math.sin(s*4.1)*.035};
}
