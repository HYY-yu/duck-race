import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignAttribution} from '../src/campaign-attribution';
import {createGrowthActions} from '../src/growth-actions';
import {postHogOptions} from '../src/posthog-telemetry';

const campaign='duck_rush_launch_2026_10';
const props={language:'en' as const,course:'mountain' as const,entryCount:2};

test('only a complete closed campaign tuple is retained, with no other URL values',()=>{
 for(const source of ['x','tiktok'])assert.deepEqual(campaignAttribution(`?utm_source=${source}&utm_medium=social&utm_campaign=${campaign}&utm_content=private&name=secret&token=secret`),{utm_source:source,utm_medium:'social',utm_campaign:campaign});
 for(const search of ['',`?utm_source=x&utm_medium=social`,`?utm_source=x&utm_medium=email&utm_campaign=${campaign}`,`?utm_source=private@example.com&utm_medium=social&utm_campaign=${campaign}`,`?utm_source=x&utm_medium=social&utm_campaign=${'a'.repeat(33)}`,`?utm_source=x&utm_source=tiktok&utm_medium=social&utm_campaign=${campaign}`,`?utm_source=x&utm_medium=social&utm_campaign=${campaign}&other=${'a'.repeat(2048)}`])assert.deepEqual(campaignAttribution(search),{});
});

test('campaign is captured once in memory and overrides SDK or caller campaign values',()=>{
 const attribution={...campaignAttribution(`?utm_source=x&utm_medium=social&utm_campaign=${campaign}`)};
 const options=postHogOptions('https://example.invalid',attribution);
 attribution.utm_source='private@example.com';
 const filter=options.before_send as (event:unknown)=>{properties:Record<string,unknown>};
 const payload=filter({event:'race_replayed',properties:{entryCount:2,utm_source:'secret',utm_campaign:'secret',utm_content:'secret',$current_url:'private',names:'private'}});
 assert.deepEqual(payload.properties,{entryCount:2,utm_source:'x',utm_medium:'social',utm_campaign:campaign,$geoip_disable:true});
 const noCampaign=postHogOptions('https://example.invalid').before_send as typeof filter;
 assert.deepEqual(noCampaign({event:'results_copied',properties:{utm_source:'tiktok',utm_medium:'social',utm_campaign:campaign}}).properties,{$geoip_disable:true});
 assert.equal(options.persistence,'memory');
});

test('replay counts only when the requested next round actually starts, and reset/edit cancels it',()=>{
 const events:unknown[][]=[];const actions=createGrowthActions((...args)=>events.push(args));
 actions.started(props);assert.equal(events.length,0);
 actions.reset(true);assert.equal(events.length,0);
 actions.started(props);actions.started(props);
 assert.deepEqual([...events],[['race_replayed',props]]);
 actions.reset(true);actions.reset();actions.started(props);assert.equal(events.length,1);
 const fresh=createGrowthActions((...args)=>events.push(args));fresh.started(props);assert.equal(events.length,1);
});

test('copy counts once per round only after success, suppresses in-flight double clicks, and allows retry',async()=>{
 const events:unknown[][]=[];const actions=createGrowthActions((...args)=>events.push(args));actions.started(props);
 await assert.rejects(actions.copy(props,async()=>{throw new Error('denied');}));assert.equal(events.length,0);
 let finish!:()=>void,writes=0;
 const pending=actions.copy(props,()=>{writes++;return new Promise<void>(resolve=>{finish=resolve;});});
 assert.equal(await actions.copy(props,async()=>{writes++;}),false);assert.equal(writes,1);assert.equal(events.length,0);
 finish();assert.equal(await pending,true);
 assert.equal(await actions.copy(props,async()=>{writes++;}),true);assert.equal(events.length,1);assert.equal(writes,2);
 actions.reset(true);actions.started(props);await actions.copy(props,async()=>{});
 assert.deepEqual(events.map(e=>e[0]),['results_copied','race_replayed','results_copied']);
});

test('a copy resolving after reset or a new round does not mark that new round copied',async()=>{
 const events:string[]=[];const actions=createGrowthActions(event=>events.push(event));actions.started(props);
 let finish!:()=>void;const pending=actions.copy(props,()=>new Promise<void>(resolve=>{finish=resolve;}));
 actions.reset();actions.started(props);finish();assert.equal(await pending,false);assert.deepEqual(events,[]);
 await actions.copy(props,async()=>{});assert.deepEqual(events,['results_copied']);
});
