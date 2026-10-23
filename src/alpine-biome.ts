import {terrainNoise} from './island-terrain';
import type {IslandTerrain} from './island-terrain';
import type {TreePlacement} from './tree-layout';
import {LAKE_LEVEL} from './track';

const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

/** Shared, seeded biome boundaries keep the treeline below the irregular snowline. */
export function alpineBiome(x:number,z:number,height:number,slope:number){
 const patch=terrainNoise(x*.024,z*.024),detail=terrainNoise(x*.075+17,z*.075-31);
 const steep=smooth(.7,1.9,slope),elevation=height+patch*9+detail*2;
 const snow=smooth(101,127,elevation)*(1-steep*.18);
 const bare=smooth(94,128,elevation);
 // Broad woodland patches with small clearings, rather than uniform random dots.
 const woodland=terrainNoise(x*.024+41,z*.024-12)+detail*.18;
 const foothill=1-smooth(28,74,height);
 const forest=(.025+.955*smooth(-.36-foothill*.18,.3,woodland))*(1-smooth(38,108,height+patch*6));
 return {patch,steep,snow,bare,forest};
}

/** Cover the whole island, including the low slopes outside the river's bounds. */
export function alpineTreeCandidates(terrain:IslandTerrain,random:()=>number){
 const candidates:TreePlacement[]=[];
 for(let i=0;i<36000;i++){
  const x=terrain.minX+random()*terrain.cols*terrain.step,z=terrain.minZ+random()*terrain.rows*terrain.step;
  const h=terrain.height(x,z);
  if(h<LAKE_LEVEL+1.4||h>114)continue;
  const biome=alpineBiome(x,z,h,terrain.slope(x,z));
  if(random()>biome.forest)continue;
  const near=terrain.nearest(x,z);
  if(near.distance<near.p.width+3)continue;
  const size=(.52+Math.pow(random(),.75)*.85)*(1-smooth(48,112,h)*.4);
  const kind=h<56&&terrainNoise(x*.035-7,z*.035+8)+random()*.65>.1?'tree-broadleaf':'tree-pine';
  candidates.push({x,y:h,z,size,kind});
 }
 return candidates;
}
