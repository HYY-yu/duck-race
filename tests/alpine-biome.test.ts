import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alpineBiome} from '../src/alpine-biome';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('alpine snow covers upper slopes while the woodland stays below it',()=>{
 for(let x=-100;x<=100;x+=20)for(let z=-100;z<=100;z+=20){
  const valley=alpineBiome(x,z,35,.3),peak=alpineBiome(x,z,145,2);
  assert.equal(valley.snow,0);assert.ok(peak.snow>=.82);assert.equal(peak.forest,0);
  const upper=alpineBiome(x,z,112,.4);
  assert.ok(upper.snow>0,'snow should reach below the former 128m threshold');
  assert.ok(upper.forest<.01,'canopy should fade out at the irregular snowline');
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
  const low=alpineBiome(x,z,40,.4),high=alpineBiome(x,z,90,.4);
  assert.deepEqual(low,alpineBiome(x,z,40,.4));
  assert.ok(high.forest<=low.forest);
  for(const value of [low.forest,low.snow,low.bare,low.steep])assert.ok(value>=0&&value<=1);
  cover.push(low.forest);
 }
 assert.ok(Math.max(...cover)-Math.min(...cover)>.65,'retain both dense groves and open meadow');
});
