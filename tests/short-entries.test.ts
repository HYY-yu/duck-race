import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';
import {campaignAttribution} from '../src/campaign-attribution';
import {postHogOptions} from '../src/posthog-telemetry';

// Inspect the actual deployable rules rather than a second redirect implementation.
test('short entrances are exact temporary same-origin redirects accepted by the existing attribution contract',()=>{
 const rules=readFileSync('public/_redirects','utf8').split('\n').map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')).map(line=>line.split(/\s+/));
 assert.equal(rules.length,2);
 assert.deepEqual(rules.map(([path])=>path),['/x','/t']);
 for(const [path,destination,status] of rules){
  assert.equal(status,'302');
  assert.ok(!existsSync(`public${path}`)&&!existsSync(`.${path}`),'short entrance must not shadow a source asset');
  const url=new URL(destination,'https://duckracepicker.com');
  assert.equal(url.origin,'https://duckracepicker.com');
  assert.equal(url.pathname,'/en/');
  assert.equal(url.hash,'');
  assert.ok(!rules.some(([source])=>source===url.pathname),'redirect must not loop');
  assert.equal([...url.searchParams].length,3);
  const attribution=campaignAttribution(url.search);
  assert.deepEqual(attribution,{utm_source:path==='/x'?'x':'tiktok',utm_medium:'social',utm_campaign:'duck_rush_launch_2026_10'});
  const filter=postHogOptions('https://analytics.invalid',attribution).before_send as (event:unknown)=>{properties:Record<string,unknown>};
  assert.deepEqual(filter({event:'page_view',properties:{app:'duck_rush',environment:'production',utm_source:'wrong',names:'fixture'}}).properties,{app:'duck_rush',environment:'production',...attribution,$geoip_disable:true});
 }
});
