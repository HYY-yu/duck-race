import {sample,TRACK_LENGTH,LAKE_LEVEL,COURSE_SCALE,LONG_COURSE,MOUNTAIN_COURSE,TRACK_SEED,bankWidth} from './track';
export function terrainNoise(x:number,z:number){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const hash=(a:number,b:number)=>{const h=Math.sin(a*127.1+b*311.7+19.3+(MOUNTAIN_COURSE?TRACK_SEED*.017:0))*43758.5453;return h-Math.floor(h);};
 const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
 return ((a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v)*2-1;
}
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** One baked height field is shared by rendering, vegetation and camera clearance.
 * Relaxation softens Voronoi-like river terraces, with the channel/shore pinned. */
export class IslandTerrain {
 readonly step=MOUNTAIN_COURSE?1.6:LONG_COURSE?1.6:1;readonly cols=Math.ceil(134*COURSE_SCALE/this.step);readonly rows=Math.ceil(158*COURSE_SCALE/this.step);readonly minX=-67*COURSE_SCALE;readonly minZ=-82*COURSE_SCALE;
 readonly heights:Float32Array;readonly bankDistances:Float32Array;
 private stations=Array.from({length:Math.ceil(TRACK_LENGTH/1.8)+1},(_,i)=>{const s=Math.min(TRACK_LENGTH,i*1.8);return {s,p:sample(s)};});
 constructor(){
  const size=(this.cols+1)*(this.rows+1),relax=new Float32Array(size);let current=new Float32Array(size);this.bankDistances=new Float32Array(size);
  for(let j=0;j<=this.rows;j++)for(let i=0;i<=this.cols;i++){
   const x=this.minX+i*this.step,z=this.minZ+j*this.step,k=j*(this.cols+1)+i,{distance:d,p}=this.nearest(x,z),bank=Math.max(0,d-p.width+.8);
   this.bankDistances[k]=d-p.width;
   const relief=(terrainNoise(x*.075,z*.075)+.3*terrainNoise(x*.19+13,z*.19-9))*Math.min(1.5,bank*.27);
   let h=p.y-.8-3*Math.max(0,1-d/(p.width+.4))+Math.min(6.5,bank*.5)+relief;
   const angle=Math.atan2((z+7*COURSE_SCALE)/(65*COURSE_SCALE),x/(53*COURSE_SCALE)),radius=Math.hypot(x/(53*COURSE_SCALE),(z+7*COURSE_SCALE)/(65*COURSE_SCALE))/(1+.075*Math.sin(angle*3+.6)+.045*Math.cos(angle*5));
   const shelf=LAKE_LEVEL+33*Math.pow(1-smooth(.5,1,radius),1.6)-Math.max(0,radius-.92)*27;
   if(MOUNTAIN_COURSE){
    const ridges=terrainNoise(x*.055,z*.055)*4+terrainNoise(x*.14,z*.14)*1.5;
    const ridge=18*Math.exp(-((x/65)**2+((z+25)/48)**2)) + 24*Math.exp(-(((x-43)/42)**2+((z+8)/55)**2));
    const mountain=ridge+LAKE_LEVEL-1-5*smooth(1,1.35,radius)+Math.pow(Math.max(0,1-radius/1.15),1.35)*(155+ridges*6);
    const channel=p.y-.8-3*Math.max(0,1-d/(p.width+.4))+bank*.55+relief;
    const blend=smooth(0,25,bank);h=channel*(1-blend)+mountain*blend;
   }else h=Math.min(h,shelf)-smooth(31*COURSE_SCALE,43*COURSE_SCALE,z)*5;
   current[k]=Math.max(-5,h);
   relax[k]=smooth(p.width+.8,p.width+4,d)*smooth(LAKE_LEVEL-.5,LAKE_LEVEL+2.5,h)*.72;
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
  this.heights=current;
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
 height(x:number,z:number){
  const u=(x-this.minX)/this.step,v=(z-this.minZ)/this.step;if(u<0||v<0||u>this.cols||v>this.rows)return -5;
  const i=Math.min(this.cols-1,Math.floor(u)),j=Math.min(this.rows-1,Math.floor(v)),fx=u-i,fz=v-j,k=j*(this.cols+1)+i;
  const a=this.heights[k],b=this.heights[k+1],c=this.heights[k+this.cols+1],d=this.heights[k+this.cols+2];
  // Match the actual mesh diagonal, rather than a different bilinear surface.
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:b*(1-fz)+c*(1-fx)+d*(fx+fz-1);
 }
 slope(x:number,z:number){return Math.hypot(this.height(x+.5,z)-this.height(x-.5,z),this.height(x,z+.5)-this.height(x,z-.5));}
}
