import assert from 'node:assert/strict';
import {Race} from '../src/simulation';
import {sample,world,TRACK_LENGTH,TRACK_SEED,bankWidths,bankWidth,flow,curvature,FALLS,blockers,MOUNTAIN_COURSE} from '../src/track';
import {IslandTerrain} from '../src/island-terrain';
console.info=()=>{};console.debug=()=>{};
assert.ok(MOUNTAIN_COURSE);
let bends=0;
for(let s=1;s<TRACK_LENGTH-1;s+=.5){
 assert.ok(Object.values(sample(s)).every(Number.isFinite));assert.ok(sample(s).y>=sample(s+.2).y);
 const c=curvature(s),b=bankWidths(s);
 assert.ok(Math.abs(b.left+b.right-2*sample(s).width)<1e-9);
 if(Math.abs(c)>.015&&Math.abs(s-blockers[0].s)>blockers[0].length/2+2.5){const side=Math.sign(c);assert.ok(bankWidth(s,side)<bankWidth(s,-side));assert.ok(flow(s,side,0)>flow(s,-side,0));bends++;}
}
assert.ok(bends>5);
const terrain=new IslandTerrain();for(let s=0;s<TRACK_LENGTH;s+=1){const p=world(s);assert.ok(terrain.height(p.x,p.z)<p.y+.1,`river buried at ${s}`);}
const runs=[];
for(const count of [2,6,12]){
 const race=new Race(count,917);race.start();for(let i=0;i<60*180&&race.state!=='finished';i++)race.step(1/60);
 assert.equal(race.state,'finished',`track ${TRACK_SEED}, count ${count}`);
 for(const d of race.ducks){assert.ok([d.s,d.y,d.lane,d.v].every(Number.isFinite));assert.equal(d.landings,FALLS.length,`landings ${d.id}`);}
 runs.push({count,time:race.time,recoveries:race.ducks.reduce((n,d)=>n+d.recoveries,0)});
}
console.log(JSON.stringify({seed:TRACK_SEED,length:TRACK_LENGTH,start:world(0),runs}));
