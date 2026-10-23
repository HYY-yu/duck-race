import assert from 'node:assert/strict';
import {IslandTerrain} from '../src/island-terrain';
import {alpineBiome,alpineTreeCandidates} from '../src/alpine-biome';
import {selectTreePlacements,treeRadius,TREE_GAP} from '../src/tree-layout';
import {LAKE_LEVEL} from '../src/track';

let state=42;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const terrain=new IslandTerrain(),candidates=alpineTreeCandidates(terrain,random);
const layout=selectTreePlacements(candidates,terrain,{canopySpacing:.78,limit:1600}),trees=layout.trees;
const foothill=trees.filter(t=>t.y<LAKE_LEVEL+40),middle=trees.filter(t=>t.y>=LAKE_LEVEL+40&&t.y<LAKE_LEVEL+80),upper=trees.filter(t=>t.y>=LAKE_LEVEL+80);
assert.ok(trees.length>650,'retain substantial island woodland');
assert.ok(foothill.length>trees.length*.20&&middle.length>trees.length*.20,'forest covers both the lower flanks and the mid slopes');
assert.ok(upper.length<trees.length*.20,'leave only scattered trees near the treeline');
for(const t of trees){
 const snow=alpineBiome(t.x,t.z,t.y,terrain.slope(t.x,t.z)).snow;
 assert.ok(snow<.5,`no canopy inside the snow zone at ${t.x.toFixed(0)},${t.z.toFixed(0)} (snow ${snow.toFixed(2)})`);
}
// Most trees stand in groves; scattered outliers near the treeline are intended, so the
// assertion is on the majority, not on every single tree.
const connected=trees.filter(t=>trees.some(o=>o!==t&&Math.hypot(t.x-o.x,t.z-o.z)<14));
assert.ok(connected.length>trees.length*.85,'forest forms connected groves rather than isolated dots');
assert.ok(trees.filter(t=>t.z>89).length>80,'cover the formerly empty outer slopes');
assert.ok(foothill.filter(t=>trees.some(other=>other!==t&&Math.hypot(t.x-other.x,t.z-other.z)<9)).length>foothill.length*.8,'foothill trees form groves');
for(const [i,t] of trees.entries()){
 const near=terrain.nearest(t.x,t.z);
 assert.ok(near.distance>=near.p.width+treeRadius(t)+.9,'full canopy clears the river');
 for(const other of trees.slice(i+1))assert.ok(Math.hypot(t.x-other.x,t.z-other.z)>=(treeRadius(t)+treeRadius(other))*.78+TREE_GAP);
}
console.log(JSON.stringify({count:trees.length,foothill:foothill.length,middle:middle.length,upper:upper.length}));
