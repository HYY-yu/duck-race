import {terrainNoise,ridgedNoise,softNoise} from './noise';
import type {IslandTerrain} from './island-terrain';
import type {TreePlacement} from './tree-layout';
import {LAKE_LEVEL} from './track';

const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

/** Shared, seeded biome boundaries.
 * Three things make planted-looking scenery: a cover field with real zeros (clearings),
 * a woodland mask that follows terrain rather than altitude alone, and a treeline soft
 * enough to produce scattered outliers instead of a hard band. */
export function alpineBiome(x:number,z:number,height:number,slope:number){
 const patch=terrainNoise(x*.024,z*.024),detail=terrainNoise(x*.075+17,z*.075-31);
 const steep=smooth(.7,1.9,slope),elevation=height+patch*9+detail*2;
 const snow=smooth(96,122,elevation)*(1-steep*.18);
 const bare=smooth(90,124,elevation);

 // Woodland belongs to sheltered, gently sloping ground: spurs and hollows are carved
 // by two noise scales so groves have edges a viewer can read from above.
 const grove=softNoise(x*.019+41,z*.019-12,3);
 const thicket=softNoise(x*.052-9,z*.052+23,2)*.42;
 // Trees do grow on steep alpine ground; only cliffs are bare. This keeps forest in the
 // gullies and off the rock faces where it actually belongs.
 const shelter=1-smooth(1.25,2.55,slope);
 const cover=.5+grove*.62+thicket;
 // Treeline sits below the snowline and fades upward, leaving scattered outliers rather
 // than a hard edge; above it the ground is scree and snow.
 const room=1-smooth(58,104,height+patch*7);
 // Below the waterline there is no canopy at all; the apron is meadow.
 const forest=Math.max(0,Math.min(1,(cover-.30)*1.85))*room*shelter*smooth(LAKE_LEVEL+.4,LAKE_LEVEL+4,height);
 return {patch,steep,snow,bare,forest,cover};
}

/** Scree and rock exposure: steep faces plus a noise-masked mid-flank band. The mask
 * keeps rocky ground in the massif, so low valley floor stays meadow. */
export function rockExposure(x:number,z:number,height:number,slope:number,mass:number){
 const band=Math.max(0,Math.min(1,smooth(.82,1.5,slope)*.85+Math.max(0,ridgedNoise(x*.055,z*.055,3)-.62)*1.5));
 return Math.max(0,Math.min(1,band*(.35+.65*mass)));
}

/** Cover the whole island, including the low slopes outside the river's bounds. */
export function alpineTreeCandidates(terrain:IslandTerrain,random:()=>number){
 const candidates:TreePlacement[]=[];
 for(let i=0;i<42000;i++){
  const x=terrain.minX+random()*terrain.cols*terrain.step,z=terrain.minZ+random()*terrain.rows*terrain.step;
  const h=terrain.height(x,z);
  if(h<LAKE_LEVEL+1.6||h>150)continue;
  const biome=alpineBiome(x,z,h,terrain.slope(x,z));
  if(random()>biome.forest)continue;
  const near=terrain.nearest(x,z);
  if(near.distance<near.p.width+3)continue;
  // Trees shrink with altitude, and hard: a full-size pine at the treeline is the
  // clearest tell of copied scenery.
  const shrink=1-smooth(46,132,h)*.52;
  const size=(.62+Math.pow(random(),.62)*.78)*shrink;
  const kind=h<62&&terrainNoise(x*.035-7,z*.035+8)+random()*.55>.14?'tree-broadleaf':'tree-pine';
  candidates.push({x,y:h,z,size,kind});
 }
 return candidates;
}
