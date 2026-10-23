import assert from 'node:assert/strict';
import {IslandTerrain} from '../src/island-terrain';
import {alpineTreeCandidates} from '../src/alpine-biome';
import {selectTreePlacements,treeRadius,TREE_GAP} from '../src/tree-layout';

let state=42;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const terrain=new IslandTerrain(),candidates=alpineTreeCandidates(terrain,random);
const layout=selectTreePlacements(candidates,terrain,{canopySpacing:.78,limit:1600}),trees=layout.trees;
const foothill=trees.filter(t=>t.y<40),middle=trees.filter(t=>t.y>=40&&t.y<75),upper=trees.filter(t=>t.y>=75);
assert.ok(trees.length>650,'retain substantial island woodland');
assert.ok(foothill.length>middle.length*1.5,'concentrate the forest at the mountain foot');
assert.ok(upper.length<trees.length*.15,'leave only scattered trees near the treeline');
assert.ok(trees.filter(t=>t.z>89).length>80,'cover the formerly empty outer slopes');
assert.ok(foothill.filter(t=>trees.some(other=>other!==t&&Math.hypot(t.x-other.x,t.z-other.z)<9)).length>foothill.length*.8,'foothill trees form groves');
for(const [i,t] of trees.entries()){
 const near=terrain.nearest(t.x,t.z);
 assert.ok(near.distance>=near.p.width+treeRadius(t)+.9,'full canopy clears the river');
 for(const other of trees.slice(i+1))assert.ok(Math.hypot(t.x-other.x,t.z-other.z)>=(treeRadius(t)+treeRadius(other))*.78+TREE_GAP);
}
console.log(JSON.stringify({count:trees.length,foothill:foothill.length,middle:middle.length,upper:upper.length}));
