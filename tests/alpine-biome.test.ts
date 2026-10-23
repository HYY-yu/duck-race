import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alpineBiome,rockExposure} from '../src/alpine-biome';
import {LAKE_LEVEL} from '../src/track';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('alpine snow covers upper slopes while the woodland stays below it',()=>{
 for(let x=-100;x<=100;x+=20)for(let z=-100;z<=100;z+=20){
  const valley=alpineBiome(x,z,LAKE_LEVEL+30,.3),peak=alpineBiome(x,z,LAKE_LEVEL+132,2);
  assert.equal(valley.snow,0);assert.ok(peak.snow>=.78,'the summit is under snow');
  assert.ok(peak.forest<.05,'no canopy survives in the snow zone');
  const upper=alpineBiome(x,z,LAKE_LEVEL+112,.4);
  assert.ok(upper.snow>0,'snow reaches below the summit');
  assert.ok(upper.forest<.02,'canopy fades out at the irregular snowline');
 }
});

test('mountain woodland covers the foothills in groves and thins toward the snowline',()=>{
 for(const seed of [42,917]){
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./alpine-forest.fixture.ts',import.meta.url))],{env:{...process.env,DUCK_TRACK:'mountain',DUCK_SEED:String(seed)},encoding:'utf8',timeout:15000});
 }
});

test('woodland has reproducible clearings and smooth altitude transitions',()=>{
 const cover:number[]=[];
 for(let x=-100;x<=100;x+=10)for(let z=-100;z<=100;z+=10){
  const low=alpineBiome(x,z,40,.4),high=alpineBiome(x,z,96,.4);
  assert.deepEqual(low,alpineBiome(x,z,40,.4));
  assert.ok(high.forest<=low.forest,'canopy never increases with altitude');
  for(const value of [low.forest,low.snow,low.bare,low.steep])assert.ok(value>=0&&value<=1);
  cover.push(low.forest);
 }
 assert.ok(Math.max(...cover)-Math.min(...cover)>.30,'retain both dense groves and open meadow');
 assert.ok(Math.min(...cover)<.05||Math.max(...cover)>0,'the cover field keeps real gaps');
});

test('rock exposure stays on steep and high ground, not on valley meadow',()=>{
 for(let x=-120;x<=120;x+=15)for(let z=-120;z<=120;z+=15){
  const flatMeadow=rockExposure(x,z,LAKE_LEVEL+9,.25,0),cliff=rockExposure(x,z,90,2.6,1);
  assert.ok(flatMeadow<=.20,`meadow at ${x},${z} must stay mostly grassy`);
  assert.ok(cliff>flatMeadow,'cliffs expose more rock than meadow');
  for(const v of [flatMeadow,cliff])assert.ok(v>=0&&v<=1);
 }
});
