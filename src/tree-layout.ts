import {LAKE_LEVEL,TRACK_LENGTH,obstacles,sample,world,COURSE_SCALE,RAINBOWS,SLIDE,LONG_COURSE,WINDMILL_S} from './track';

export type TreeKind='tree-broadleaf'|'tree-pine';
export type TreePlacement={x:number;y:number;z:number;size:number;kind:TreeKind};
// Conservative radii measured from the shipped meshes at their displayed heights.
export const TREE_DIMENSIONS={
 'tree-broadleaf':{radius:3.2,height:5.8,canopyFloor:2.7},
 'tree-pine':{radius:2.2,height:6.5,canopyFloor:2.4},
} as const;
export const TREE_GAP=.65;
type Terrain={height:(x:number,z:number)=>number;slope:(x:number,z:number)=>number;nearest:(x:number,z:number)=>{distance:number;p:{width:number}}};
export function treeRadius(tree:TreePlacement){return TREE_DIMENSIONS[tree.kind].radius*tree.size;}
export function treeReservations(){
 const circles=obstacles.map(o=>{const p=sample(o.s),v=world(o.s,o.kind==='fan'?-(p.width+.8):0);return {x:v.x,z:v.z,radius:o.kind==='fan'?2:p.width+1.1};});
 for(const s of [7,TRACK_LENGTH-2]){const p=sample(s);circles.push({x:p.x,z:p.z,radius:p.width+1.2});}
 const spring=sample(0);circles.push({x:spring.x-spring.tx*3,z:spring.z-spring.tz*3,radius:4.5});
 circles.push({x:-COURSE_SCALE,z:40*COURSE_SCALE,radius:5});
 for(const s of [...RAINBOWS,...(LONG_COURSE?[SLIDE.start,SLIDE.end,WINDMILL_S]:[])]){const p=sample(s);circles.push({x:p.x,z:p.z,radius:p.width+3});}
 for(const s of [28,105,185]){const p=sample(s),v=world(s,p.width+3);circles.push({x:v.x,z:v.z,radius:1.2});}
 return circles;
}
/** Thin the existing deterministic scatter; never add RNG calls or move racers.
 * Metrics hook: placement rejection counts and canopy clearance by scenery kind. */
export function selectTreePlacements(candidates:readonly TreePlacement[],terrain:Terrain,options:{canopySpacing?:number;limit?:number}={}){
 const trees:TreePlacement[]=[],rejected={river:0,reserved:0,slope:0,overlap:0},reservations=treeReservations();
 for(const tree of candidates){
  const radius=treeRadius(tree),near=terrain.nearest(tree.x,tree.z);
  if(near.distance<near.p.width+radius+.9||tree.y<LAKE_LEVEL+.8){rejected.river++;continue;}
  if(reservations.some(p=>Math.hypot(tree.x-p.x,tree.z-p.z)<radius+p.radius)){rejected.reserved++;continue;}
  let rootBase=tree.y;let uneven=terrain.slope(tree.x,tree.z)>1.35;
  for(let i=0;i<8&&!uneven;i++){
   const a=i*Math.PI/4,dx=Math.cos(a),dz=Math.sin(a);
   const root=terrain.height(tree.x+dx*.45*tree.size,tree.z+dz*.45*tree.size);
   const crown=terrain.height(tree.x+dx*radius*.8,tree.z+dz*radius*.8);
   rootBase=Math.min(rootBase,root);
   uneven=Math.abs(root-tree.y)>.65*tree.size||crown>tree.y+TREE_DIMENSIONS[tree.kind].canopyFloor*tree.size-.15;
  }
  if(uneven){rejected.slope++;continue;}
  // Slightly interlocking crowns form woodland; river/prop clearance uses full radii.
  if(trees.some(other=>Math.hypot(tree.x-other.x,tree.z-other.z)<(radius+treeRadius(other))*(options.canopySpacing??1)+TREE_GAP)){rejected.overlap++;continue;}
  trees.push({...tree,y:rootBase-.04*tree.size});
  if(trees.length>=(options.limit??Infinity))break;
 }
 return {trees,rejected,candidates:candidates.length};
}
