export type MountainPoint={x:number;y:number;z:number};
export function seededRandom(seed:number){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
/** Expanding spiral keeps consecutive reaches apart while descending a carved mountain. */
export function mountainAnchors(seed:number):MountainPoint[]{
 const random=seededRandom(seed),phase=-Math.PI/2+(random()-.5)*.65,turns=.78+random()*.08,radius=38+random()*5,wobble=random()*Math.PI*2;
 const points=Array.from({length:25},(_,i)=>{
  const t=i/24,r=9+radius*t+1.4*Math.sin(t*11+wobble),a=phase+t*Math.PI*2*turns;
  return {x:r*Math.cos(a),z:r*Math.sin(a),y:29-27*t};
 });
 const a=points.at(-2)!,b=points.at(-1)!,n=Math.hypot(b.x-a.x,b.z-a.z);
 for(let i=1;i<=3;i++)points.push({x:b.x+(b.x-a.x)/n*i*6,z:b.z+(b.z-a.z)/n*i*6,y:2});
 return points;
}
