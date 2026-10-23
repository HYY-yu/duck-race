import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VoiceLogStore} from '../src/voice-diagnostics';

class MemoryStorage {
 private data=new Map<string,string>();
 getItem(key:string){return this.data.get(key)??null;}
 setItem(key:string,value:string){this.data.set(key,value);}
 removeItem(key:string){this.data.delete(key);}
}

test('voice diagnostics persist bounded recognition data and can be cleared',()=>{
 const storage=new MemoryStorage(),now=Date.parse('2026-10-23T10:00:00.000Z');
 const logs=new VoiceLogStore(storage,()=>now);
 for(let i=0;i<85;i++)logs.record({kind:'recognition',transcripts:[`候选 ${i}`],final:i%2===0,camera:'follow',selected:0});
 assert.equal(logs.entries.length,80);assert.equal(logs.entries[0].transcripts?.[0],'候选 5');
 const restored=new VoiceLogStore(storage,()=>now);assert.equal(restored.entries.length,80);assert.match(restored.text(),/候选 84/);
 restored.clear();assert.equal(restored.entries.length,0);assert.equal(new VoiceLogStore(storage,()=>now).entries.length,0);
});

test('voice diagnostics discard entries older than 24 hours and truncate raw candidates',()=>{
 const storage=new MemoryStorage(),start=Date.parse('2026-10-21T10:00:00.000Z');
 new VoiceLogStore(storage,()=>start).record({kind:'recognition',transcripts:['旧'.repeat(300)],final:true});
 assert.equal(new VoiceLogStore(storage,()=>start+25*60*60*1000).entries.length,0);
 const current=new VoiceLogStore(storage,()=>start);current.record({kind:'recognition',transcripts:Array.from({length:8},(_,i)=>String(i)),final:false});
 assert.equal(current.entries.at(-1)?.transcripts?.length,5);
});
