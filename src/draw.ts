import {COLORS,isDuckColor,type ColorChoice} from './duck-palette';
// Participant identity is shuffled independently of the physical race seed.
// A seeded race alone is reproducible, but does not make physical duck IDs equally likely to win.
export const MIN_ENTRIES=2,MAX_ENTRIES=12,MAX_NAME_LENGTH=40;
export type ListError='count'|'duplicate'|'length'|'control';
export function parseParticipants(text:string):{names:string[];error:ListError|null}{
 const names=text.split(/\r?\n/).map(s=>s.trim().normalize('NFC')).filter(Boolean);
 if(names.length<MIN_ENTRIES||names.length>MAX_ENTRIES)return {names,error:'count'};
 if(names.some(n=>/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(n)))return {names,error:'control'};
 if(names.some(n=>Array.from(n).length>MAX_NAME_LENGTH))return {names,error:'length'};
 const keys=names.map(n=>n.normalize('NFKC').toLowerCase());
 return {names,error:new Set(keys).size===keys.length?null:'duplicate'};
}
export const escapeHTML=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export type Entropy=()=>number;
const cryptoWord:Entropy=()=>{if(!globalThis.crypto?.getRandomValues)throw Error('Secure random source unavailable');return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]};
function word(entropy:Entropy){const value=entropy();if(!Number.isInteger(value)||value<0||value>=2**32)throw Error('Invalid random source');return value;}
export function randomInt(bound:number,entropy:Entropy=cryptoWord){
 if(!Number.isInteger(bound)||bound<1||bound>2**32)throw new RangeError('Invalid random bound');
 const limit=2**32-(2**32%bound);
 for(let attempt=0;attempt<1024;attempt++){const value=word(entropy);if(value<limit)return value%bound;}
 throw Error('Random source rejection limit reached');
}
export interface DrawSession {readonly id:string;readonly date:string;readonly seed:number;readonly names:readonly string[];readonly winnerCount:number;readonly colors?:readonly string[]}
export function createDraw(names:readonly string[],winnerCount:number,entropy:Entropy=cryptoWord,colorChoices?:readonly ColorChoice[]):DrawSession{
 const parsed=parseParticipants(names.join('\n'));
 if(parsed.error||parsed.names.length!==names.length||!Number.isInteger(winnerCount)||winnerCount<1||winnerCount>names.length)throw Error('Invalid draw configuration');
 if(colorChoices&&(colorChoices.length!==names.length||colorChoices.some(c=>c!==null&&!isDuckColor(c))))throw Error('Invalid color configuration');
 const shuffled=[...parsed.names],choices=colorChoices?[...colorChoices]:undefined;
 for(let i=shuffled.length-1;i>0;i--){const j=randomInt(i+1,entropy);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];if(choices)[choices[i],choices[j]]=[choices[j],choices[i]];}
 const seed=word(entropy),id='DR-'+Array.from({length:4},()=>word(entropy).toString(16).padStart(8,'0')).join('');
 // Cosmetic random draws happen after identity, seed and ID draws; colors cannot influence them.
 const available=COLORS.filter(c=>!choices?.includes(c));const colors=choices?.map(c=>{if(c)return c;const pool=available.length?available:COLORS;const index=randomInt(pool.length,entropy),color=pool[index];if(pool===available)available.splice(index,1);return color;});
 return Object.freeze({...(colors?{colors:Object.freeze(colors)}:{}),id,date:new Date().toISOString(),seed,names:Object.freeze(shuffled),winnerCount});
}
export interface SavedDraw {date:string;seed:number;results:{id:number;time:number}[];names?:string[];winnerCount?:number;drawId?:string;colors?:string[];course?:'standard'|'long'|'mountain';trackSeed?:number;controlled?:boolean;mode?:'ranking'}
// localStorage is untrusted input. Rebuild records rather than spreading arbitrary stored properties.
export function validateHistory(raw:unknown):SavedDraw[]{
 if(!Array.isArray(raw))return [];
 const valid:SavedDraw[]=[];
 for(const item of raw){
  if(!item||typeof item!=='object')continue;
  const r=item as Record<string,unknown>,results=r.results;
  if(typeof r.date!=='string'||!Number.isFinite(Date.parse(r.date))||!Number.isInteger(r.seed)||(r.seed as number)<0||(r.seed as number)>=2**32||!Array.isArray(results)||results.length<2||results.length>12)continue;
  if(!results.every(d=>d&&typeof d==='object'&&Number.isInteger(d.id)&&d.id>=0&&d.id<results.length&&Number.isFinite(d.time)&&d.time>=0)||new Set(results.map(d=>d.id)).size!==results.length||results.some((d,i)=>i>0&&d.time<results[i-1].time))continue;
  const record:SavedDraw={date:r.date,seed:r.seed as number,results:results.map(d=>({id:d.id,time:d.time}))};
  if(r.mode!==undefined&&r.mode!=='ranking')continue;
  if(r.mode==='ranking')record.mode='ranking';
  if(r.names!==undefined){
   if(!Array.isArray(r.names)||!r.names.every(n=>typeof n==='string')||r.names.length!==results.length)continue;
   const parsed=parseParticipants(r.names.join('\n'));
   if(parsed.error||parsed.names.length!==r.names.length||parsed.names.some((n,i)=>n!==(r.names as string[])[i]))continue;
   if((r.mode!=='ranking'&&(!Number.isInteger(r.winnerCount)||(r.winnerCount as number)<1||(r.winnerCount as number)>results.length))||typeof r.drawId!=='string'||!/^DR-[0-9a-f]{32}$/.test(r.drawId))continue;
   record.names=[...parsed.names];if(r.mode!=='ranking')record.winnerCount=r.winnerCount as number;record.drawId=r.drawId;
  }
  if(r.colors!==undefined){if(!Array.isArray(r.colors)||r.colors.length!==results.length||!r.colors.every(isDuckColor))continue;record.colors=[...r.colors];}
  if(r.trackSeed!==undefined){if(!Number.isInteger(r.trackSeed)||Number(r.trackSeed)<0||Number(r.trackSeed)>0xffffffff)continue;record.trackSeed=Number(r.trackSeed);}
  if(r.controlled!==undefined){if(typeof r.controlled!=='boolean')continue;record.controlled=r.controlled;}
  if(r.course!==undefined){if(r.course!=='standard'&&r.course!=='long'&&r.course!=='mountain')continue;record.course=r.course;}
  valid.push(record);if(valid.length===10)break;
 }
 return valid;
}
export function resultText(record:SavedDraw,lang:'zh'|'en',fallback:(id:number)=>string){
 const label=lang==='zh',k=record.winnerCount??1;
 return [label?'小鸭抽签结果':'Duck Rush draw results',record.drawId??'',record.date,record.course?(label?(record.course==='mountain'?'雪岭激流':record.course==='long'?'长赛道 · 2.15×':'标准赛道'):(record.course==='mountain'?'Snowpeak Rapids':record.course==='long'?'Long course · 2.15×':'Standard course')):'',record.mode==='ranking'?(label?'完整冲线排名':'Full finishing order'):`${label?'抽取人数':'Selected'}: ${k}/${record.results.length}`,...record.results.map((d,i)=>`${i+1}. ${record.names?.[d.id]??fallback(d.id)}${record.mode!=='ranking'&&i<k?(label?' [中签]':' [Selected]'):''}`),`Seed: ${record.seed}`,record.trackSeed!==undefined?`Track seed: ${record.trackSeed}`:'',record.controlled?(label?'包含人工拨水操作':'Includes manual steering'):'',label?'本机抽签记录，非独立审计凭证。':'Local draw record; not an independently audited proof.'].filter(Boolean).join('\n');
}
