import {MOUNTAIN_COURSE,TRACK_SEED} from './track';

/** Bilinear value noise on an integer lattice, in [-1,1]. Deterministic per seed offset. */
export function valueNoise(x:number,z:number,seed=0){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const hash=(a:number,b:number)=>{const h=Math.sin(a*127.1+b*311.7+19.3+seed)*43758.5453;return h-Math.floor(h);};
 const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
 return ((a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v)*2-1;
}
/** Map-scoped noise; the mountain course folds its track seed into the lattice offset. */
export function terrainNoise(x:number,z:number){return valueNoise(x,z,MOUNTAIN_COURSE?TRACK_SEED*.017:0);}
/** Ridged multifractal in [0,1]: creased ridge lines separated by dendritic gullies.
 * This is what makes a landform read as rock rather than as a smooth dome. */
export function ridgedNoise(x:number,z:number,octaves=5){
 let sum=0,amplitude=1,weight=1,frequency=1,normalisation=0;
 for(let i=0;i<octaves;i++){
  const ridge=1-Math.abs(valueNoise(x*frequency,z*frequency,37.4+i*11.3));
  const weighted=ridge*ridge*weight;
  sum+=weighted*amplitude;normalisation+=amplitude;
  weight=Math.min(1,Math.max(0,weighted*2.4));
  amplitude*=.5;frequency*=2.03;
 }
 return sum/normalisation;
}
/** Fractal sum of low frequencies in [-1,1]; large soft landform masks, not ridges. */
export function softNoise(x:number,z:number,octaves=3){
 let sum=0,amplitude=1,frequency=1,normalisation=0;
 for(let i=0;i<octaves;i++){
  sum+=valueNoise(x*frequency,z*frequency,5.7+i*23.1)*amplitude;normalisation+=amplitude;
  amplitude*=.52;frequency*=2.11;
 }
 return sum/normalisation;
}
