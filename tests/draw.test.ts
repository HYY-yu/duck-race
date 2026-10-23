import test from 'node:test';
import assert from 'node:assert/strict';
import {parseParticipants,createDraw,escapeHTML,randomInt,resultText,validateHistory} from '../src/draw';
import {COLORS} from '../src/duck-palette';
const entropy=(values:number[])=>{let i=0;return ()=>{assert.ok(i<values.length,'entropy exhausted');return values[i++];}};
test('participant input trims blanks, normalizes Unicode and enforces the advertised limits',()=>{
 assert.deepEqual(parseParticipants(' 小林\r\n\n Sam \n'),{names:['小林','Sam'],error:null});
 assert.equal(parseParticipants('a').error,'count');assert.equal(parseParticipants(Array.from({length:13},(_,i)=>String(i)).join('\n')).error,'count');
 assert.equal(parseParticipants(Array.from({length:12},(_,i)=>String(i)).join('\n')).error,null);
 for(const text of ['Sam\nsam','Ａ\nA','e\u0301\né'])assert.equal(parseParticipants(text).error,'duplicate');
 assert.equal(parseParticipants('a\n'+'🦆'.repeat(40)).error,null);assert.equal(parseParticipants('a\n'+'🦆'.repeat(41)).error,'length');
 for(const char of ['\u202e','\u0000','\u200b'])assert.equal(parseParticipants('a\nb'+char+'c').error,'control');
 assert.equal(escapeHTML('<img src=x onerror="alert(1)">&\''),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
});
test('bounded randomness rejects the biased tail and invalid entropy',()=>{
 assert.equal(randomInt(3,entropy([4294967295,4])),1);
 assert.equal(randomInt(1,entropy([4294967295])),0);
 for(const n of [0,-1,1.5,NaN,2**32+1])assert.throws(()=>randomInt(n));
 assert.throws(()=>randomInt(3,()=>-1));assert.throws(()=>randomInt(3,()=>4294967295),/limit/);
});
test('all six three-person assignments occur exactly once across Fisher–Yates choices',()=>{
 const permutations=new Set<string>();
 for(let a=0;a<3;a++)for(let b=0;b<2;b++){
  const session=createDraw(['A','B','C'],2,entropy([a,b,42,1,2,3,4]));
  permutations.add(session.names.join(''));assert.equal(session.seed,42);assert.equal(session.winnerCount,2);
  assert.ok(Object.isFrozen(session));assert.ok(Object.isFrozen(session.names));
 }
 assert.equal(permutations.size,6);
});
test('identity assignment does not depend on names, seed or selection count',()=>{
 const a=createDraw(['A','B','C'],1,entropy([1,0,42,1,2,3,4]));
 const b=createDraw(['X','Y','Z'],2,entropy([1,0,99,1,2,3,4]));
 assert.deepEqual(a.names.map(n=>['A','B','C'].indexOf(n)),b.names.map(n=>['X','Y','Z'].indexOf(n)));
 assert.throws(()=>createDraw(['A','A'],1));assert.throws(()=>createDraw(['A','B'],3));
});
test('history validates complete unique ordered results and keeps names independent of current entries',()=>{
 const base={date:'2026-10-22T00:00:00Z',seed:42,results:[{id:1,time:10},{id:0,time:11}]};
 assert.equal(validateHistory([base]).length,1);
 const record={...base,names:['<Sam>','Alex'],winnerCount:1,drawId:'DR-'+'a'.repeat(32)};
 assert.deepEqual(validateHistory([record])[0],record);
 const text=resultText(record,'en',()=>{throw Error('Must use saved names')});
 assert.match(text,/1\. Alex \[Selected\]/);assert.match(text,/2\. <Sam>/);assert.ok(!text.includes('<Sam> [Selected]'));
 for(const bad of [{...base,seed:-1},{...base,date:'bad'},{...base,results:[{id:0,time:2},{id:0,time:3}]},{...base,results:[{id:0,time:2},{id:1,time:1}]},{...record,winnerCount:3},{...record,names:['a','A']},{...record,drawId:'<img>'}])assert.equal(validateHistory([bad]).length,0);
 assert.equal(validateHistory(null).length,0);
});
test('a fixed physical finish order gives every name the same inclusion count for K=1 and K=2',()=>{
 for(const k of [1,2]){
  const inclusions=new Map([['A',0],['B',0],['C',0]]);
  for(let a=0;a<3;a++)for(let b=0;b<2;b++){
   const names=['A','B','C'];const session=createDraw(names,k,entropy([a,b,42,1,2,3,4]));names[0]='Changed after locking';
   assert.ok(!session.names.includes(names[0]));
   for(const id of [1,0,2].slice(0,k)){const name=session.names[id];inclusions.set(name,inclusions.get(name)!+1);}
  }
  assert.deepEqual([...inclusions.values()],[2*k,2*k,2*k]);
 }
});

test('chosen duck colors follow shuffled names and cannot change identity, seed or draw ID',()=>{
 const words=[1,0,42,1,2,3,4],plain=createDraw(['A','B','C'],1,entropy(words)),colored=createDraw(['A','B','C'],1,entropy(words),[COLORS[1],COLORS[4],COLORS[7]]);
 assert.deepEqual(colored.names,plain.names);assert.equal(colored.seed,plain.seed);assert.equal(colored.id,plain.id);
 const expected=new Map([['A',COLORS[1]],['B',COLORS[4]],['C',COLORS[7]]]);colored.names.forEach((name,i)=>assert.equal(colored.colors![i],expected.get(name)));assert.ok(Object.isFrozen(colored.colors));
 assert.throws(()=>createDraw(['A','B'],1,()=>0,[COLORS[0]]),/color/);assert.throws(()=>createDraw(['A','B'],1,()=>0,['<style>',null]),/color/);
});

test('unselected colors resolve from the palette without taking fixed colors or changing physics randomness',()=>{
 const session=createDraw(['A','B','C'],1,entropy([1,0,42,1,2,3,4,0,0]),[null,COLORS[4],null]);
 assert.equal(session.seed,42);assert.equal(session.colors![session.names.indexOf('B')],COLORS[4]);assert.equal(new Set(session.colors).size,3);assert.ok(session.colors!.every(c=>COLORS.includes(c)));
 const repeated=createDraw(['A','B'],1,entropy([0,42,1,2,3,4]),[COLORS[2],COLORS[2]]);assert.deepEqual(repeated.colors,[COLORS[2],COLORS[2]]);
});

test('saved colors are validated in duck ID order while older histories remain compatible',()=>{
 const base={date:'2026-10-22T00:00:00Z',seed:42,results:[{id:1,time:10},{id:0,time:11}],names:['A','B'],winnerCount:1,drawId:'DR-'+'a'.repeat(32)},record={...base,colors:[COLORS[2],COLORS[5]]};
 assert.deepEqual(validateHistory([record])[0],record);assert.deepEqual(validateHistory([base])[0],base);
 assert.equal(validateHistory([{...record,colors:[COLORS[2]]}]).length,0);assert.equal(validateHistory([{...record,colors:['red',COLORS[5]]}]).length,0);
});

test('history preserves course versions while accepting older records',()=>{
 const base={date:'2026-10-22T00:00:00Z',seed:42,results:[{id:0,time:100},{id:1,time:110}]};
 assert.deepEqual(validateHistory([{...base,course:'long'}])[0],{...base,course:'long'});
 assert.deepEqual(validateHistory([base])[0],base);
 assert.equal(validateHistory([{...base,course:'<script>'}]).length,0);
});

test('ranking records need no selection count and export the full order without selected markers',()=>{
 const record={mode:'ranking' as const,date:'2026-10-22T00:00:00Z',seed:42,results:[{id:1,time:10},{id:0,time:11}],names:['A','B'],drawId:'DR-'+'a'.repeat(32)};
 assert.deepEqual(validateHistory([record])[0],record);
 for(const lang of ['zh','en'] as const){const text=resultText(record,lang,String);assert.ok(text.includes('1. B'));assert.ok(text.includes('2. A'));assert.ok(!/中签|Selected|抽取人数/.test(text));}
 assert.equal(validateHistory([{...record,mode:'unknown'}]).length,0);
 const old={...record,mode:undefined,winnerCount:1};assert.equal(validateHistory([old])[0].winnerCount,1);assert.ok(resultText(old,'zh',String).includes('[中签]'));
});
