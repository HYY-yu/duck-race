import {sample,TRACK_LENGTH,LAKE_LEVEL,COURSE_SCALE,MOUNTAIN_COURSE,bankWidth} from './track';
import {terrainNoise,ridgedNoise,softNoise} from './noise';
export {terrainNoise} from './noise';
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));

/** Named summits of the massif, in world units.
 * A mountain range reads as competing peaks joined by cols. A single radial falloff is
 * exactly what makes scenery look like a lone island, so the high ground is the max of
 * several domes rather than one cone. */
const SUMMITS=[
 {x:0,z:-14,h:140,rx:58,rz:66,sharp:1.9},    // main summit, north of the grid centre
 {x:-58,z:-68,h:96,rx:44,rz:40,sharp:1.7},   // north-west shoulder
 {x:62,z:6,h:86,rx:38,rz:50,sharp:1.65},     // east spur above the outflow
 {x:12,z:-114,h:80,rx:46,rz:34,sharp:1.7},   // northern aiguille
 {x:-42,z:48,h:70,rx:44,rz:42,sharp:1.7},    // southern shoulder
 {x:48,z:-76,h:74,rx:34,rz:34,sharp:1.8},    // secondary peak behind the summit
];
function massifDome(x:number,z:number){
 let best=0;
 for(const s of SUMMITS){
  const dx=(x-s.x)/s.rx,dz=(z-s.z)/s.rz,d2=dx*dx+dz*dz;
  const v=s.h*Math.exp(-Math.pow(d2,s.sharp*.5));
  if(v>best)best=v;
 }
 return best;
}

/** Rolling valley floor the massif rises out of. Without it the land drops straight
 * below the waterline and every view reads as an island in open water. */
function valleyFloor(x:number,z:number){
 return 12.5+softNoise(x*.0085,z*.0085,3)*6+softNoise(x*.024+5,z*.024-3,2)*2.2;
}

/** Foothills: ridges and side valleys wrapping the massif. A flat apron around a peak is
 * just as artificial as water around it - the eye needs landforms continuing outward. */
function foothills(x:number,z:number){
 // Two scales: broad spurs, then secondary ridges perpendicular to them.
 const broad=ridgedNoise(x*.0068+7,z*.0068-19,4);
 const fine=ridgedNoise(x*.019-3,z*.019+11,3);
 const spur=Math.pow(Math.max(0,broad-.18)/.82,1.25);
 // Side valleys radiate between spurs rather than forming concentric terraces.
 const radius=Math.hypot(x,z+14);
 const mask=smooth(70,190,radius)*(1-smooth(430,760,radius));
 return mask*(spur*(52+18*broad)+fine*9);
}

/** Outwash lake: a bounded basin below the river mouth, fed by the runout corridor.
 * Bounded on purpose - an unbounded basin turns the valley into an ocean. */
const LAKE_MOUTH={x:-129.8,z:-50.3,dx:-.253,dz:-.967};
export const LAKE_CENTER={x:-166,z:-124,radius:112};
export function lakeBasin(x:number,z:number){
 const px=x-LAKE_CENTER.x,pz=z-LAKE_CENTER.z;
 const angle=Math.atan2(pz,px);
 const lobe=1+.14*Math.sin(angle*2.3+.4)+.08*Math.sin(angle*5.1-1.1);
 const blob=1-smooth(LAKE_CENTER.radius*.5,LAKE_CENTER.radius,Math.hypot(px,pz)/lobe);
 // Corridor links the river mouth to the basin so the water reads as one body.
 const mx=x-LAKE_MOUTH.x,mz=z-LAKE_MOUTH.z;
 const along=mx*LAKE_MOUTH.dx+mz*LAKE_MOUTH.dz,lateral=Math.abs(mx*LAKE_MOUTH.dz-mz*LAKE_MOUTH.dx);
 const corridor=(1-smooth(26,80,lateral))*smooth(-14,30,along)*(1-smooth(112,186,along));
 return Math.max(blob,corridor);
}
export function lakeFloor(){return LAKE_LEVEL-4.6;}

/** Land far from the baked grid: valley floor rising into a ring of distant ranges.
 * This fills the horizon, so the massif sits in a landscape instead of in a soup. */
export function farLandform(x:number,z:number){
 let h=valleyFloor(x,z)+foothills(x,z)+softNoise(x*.0042+21,z*.0042-6,3)*4;
 const distance=Math.hypot(x,z+16);
 const ramp=smooth(420,1120,distance);
 const ridge=Math.pow(Math.max(0,ridgedNoise(x*.0034+11,z*.0034-7,5)-.30)/.70,1.32);
 h+=ramp*(ridge*300+softNoise(x*.011+3,z*.011+9,2)*30+30);
 const basin=lakeBasin(x,z);
 return h*(1-basin)+lakeFloor()*basin;
}

export class IslandTerrain {
 readonly step=1.6;readonly cols=Math.ceil(134*COURSE_SCALE/this.step);readonly rows=Math.ceil(158*COURSE_SCALE/this.step);readonly minX=-67*COURSE_SCALE;readonly minZ=-82*COURSE_SCALE;
 readonly heights:Float32Array;readonly bankDistances:Float32Array;
 private stations=Array.from({length:Math.ceil(TRACK_LENGTH/1.8)+1},(_,i)=>{const s=Math.min(TRACK_LENGTH,i*1.8);return {s,p:sample(s)};});
 constructor(){
  const size=(this.cols+1)*(this.rows+1),relax=new Float32Array(size);let current=new Float32Array(size);this.bankDistances=new Float32Array(size);
  for(let j=0;j<=this.rows;j++)for(let i=0;i<=this.cols;i++){
   const x=this.minX+i*this.step,z=this.minZ+j*this.step,k=j*(this.cols+1)+i,{distance:d,p}=this.nearest(x,z),bank=Math.max(0,d-p.width+.8);
   this.bankDistances[k]=d-p.width;
   if(!MOUNTAIN_COURSE){
    const relief=(terrainNoise(x*.075,z*.075)+.3*terrainNoise(x*.19+13,z*.19-9))*Math.min(1.5,bank*.27);
    const h=p.y-.8-3*Math.max(0,1-d/(p.width+.4))+Math.min(6.5,bank*.5)+relief;
    const angle=Math.atan2((z+7*COURSE_SCALE)/(65*COURSE_SCALE),x/(53*COURSE_SCALE)),radius=Math.hypot(x/(53*COURSE_SCALE),(z+7*COURSE_SCALE)/(65*COURSE_SCALE))/(1+.075*Math.sin(angle*3+.6)+.045*Math.cos(angle*5));
    const shelf=LAKE_LEVEL+33*Math.pow(1-smooth(.5,1,radius),1.6)-Math.max(0,radius-.92)*27;
    current[k]=Math.max(-5,Math.min(h,shelf)-smooth(31*COURSE_SCALE,43*COURSE_SCALE,z)*5);
    relax[k]=smooth(p.width+.8,p.width+4,d)*smooth(LAKE_LEVEL-.5,LAKE_LEVEL+2.5,current[k])*.72;
    continue;
   }
   current[k]=this.mountainSurface(x,z,d,p.width,bank);
   relax[k]=smooth(p.width+.8,p.width+4,d)*smooth(LAKE_LEVEL-.5,LAKE_LEVEL+2.5,current[k])*.72;
  }
  // Several small passes create irregular continuous slopes without smoothing the river away.
  for(let pass=0;pass<7;pass++){
   const next=new Float32Array(current);
   for(let j=2;j<this.rows-1;j++)for(let i=2;i<this.cols-1;i++){
    const k=j*(this.cols+1)+i;if(relax[k]===0)continue;let sum=0,weights=0;
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const weight=1/(1+dx*dx+dz*dz);sum+=current[k+dz*(this.cols+1)+dx]*weight;weights+=weight;}
    next[k]=current[k]+(sum/weights-current[k])*relax[k];
   }
   current=next;
  }
  // The lake basin is carved last so its shoreline stays crisp.
  if(MOUNTAIN_COURSE)for(let j=0;j<=this.rows;j++)for(let i=0;i<=this.cols;i++){
   const k=j*(this.cols+1)+i,basin=lakeBasin(this.minX+i*this.step,this.minZ+j*this.step);
   if(basin>0)current[k]=current[k]*(1-basin)+lakeFloor()*basin;
  }
  this.heights=current;
 }
 /** Terrain near the channel follows the water's own height, so the gorge walls rise
  * out of the water at a walkable grade. Away from the channel it becomes the massif. */
 private mountainSurface(x:number,z:number,d:number,width:number,bank:number){
  const relief=(terrainNoise(x*.075,z*.075)+.3*terrainNoise(x*.19+13,z*.19-9))*Math.min(1.5,bank*.27);
  const p=sampleAlong(this,x,z);
  const channel=p.y-.8-3*Math.max(0,1-d/(width+.4))+bank*.55+relief;

  // Multi-summit massif, with ridge spurs feeding down the flanks.
  const dome=massifDome(x,z);
  const high=Math.min(1,dome/110);
  const angle=Math.atan2(z+14,x);
  const spur=Math.pow(Math.abs(Math.cos(angle*3.7+Math.sin(angle*3.1)*.55)),.62);
  const flank=Math.pow(Math.max(0,Math.min(1,1-dome/150)),1.25);
  const radialRelief=(spur*2-1)*flank*22*(.30+.70*high);
  const crest=ridgedNoise(x*.028,z*.028,4);
  const detail=ridgedNoise(x*.078+31,z*.078-17,3);
  const relief2=flank*(10*crest+4.5*detail)*(.25+.75*high);
  const cirque=-13*Math.exp(-(Math.pow((x-30)/34,2)+Math.pow((z+52)/32,2)))*high;

  const massif=valleyFloor(x,z)+dome+foothills(x,z)+radialRelief+relief2+cirque;
  const blend=smooth(0,25,bank);
  const carved=channel*(1-blend)+massif*blend;
  const basin=lakeBasin(x,z);
  return Math.max(-5,carved*(1-basin)+lakeFloor()*basin);
 }
 nearest(x:number,z:number){
  let distance=Infinity,s=0;
  for(let i=0;i<this.stations.length-1;i++){
   const a=this.stations[i],b=this.stations[i+1],dx=b.p.x-a.p.x,dz=b.p.z-a.p.z;
   const t=Math.max(0,Math.min(1,((x-a.p.x)*dx+(z-a.p.z)*dz)/(dx*dx+dz*dz||1))),dist=Math.hypot(x-a.p.x-dx*t,z-a.p.z-dz*t);
   if(dist<distance){distance=dist;s=a.s+(b.s-a.s)*t;}
  }
  const p=sample(s),lane=(x-p.x)*-p.tz+(z-p.z)*p.tx;return {distance,s,p:{...p,width:bankWidth(s,lane)}};
 }
 /** Baked grid lookup, clamped at the edges. */
 private gridHeight(x:number,z:number){
  const u=clamp((x-this.minX)/this.step,0,this.cols-.0001),v=clamp((z-this.minZ)/this.step,0,this.rows-.0001);
  const i=Math.floor(u),j=Math.floor(v),fx=u-i,fz=v-j,k=j*(this.cols+1)+i;
  const a=this.heights[k],b=this.heights[k+1],c=this.heights[k+this.cols+1],d=this.heights[k+this.cols+2];
  // Match the actual mesh diagonal, rather than a different bilinear surface.
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:b*(1-fz)+c*(1-fx)+d*(fx+fz-1);
 }
 height(x:number,z:number){
  if(!MOUNTAIN_COURSE)return this.gridHeight(x,z);
  const inside=x>=this.minX&&x<=this.minX+this.cols*this.step&&z>=this.minZ&&z<=this.minZ+this.rows*this.step;
  if(inside)return this.gridHeight(x,z);
  // Blend from the baked edge into the procedural landscape so the two meshes meet.
  const edgeX=clamp(x,this.minX,this.minX+this.cols*this.step),edgeZ=clamp(z,this.minZ,this.minZ+this.rows*this.step);
  const out=Math.hypot(x-edgeX,z-edgeZ),t=smooth(0,190,out);
  return this.gridHeight(edgeX,edgeZ)*(1-t)+farLandform(x,z)*t;
 }
 slope(x:number,z:number){return Math.hypot(this.height(x+.5,z)-this.height(x-.5,z),this.height(x,z+.5)-this.height(x,z-.5));}
}
/** Water surface height at the station nearest to a grid point; used to seat the channel. */
function sampleAlong(field:IslandTerrain,x:number,z:number){return field.nearest(x,z).p;}
