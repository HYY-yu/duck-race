export type VoiceLogKind='recognition'|'decision'|'status'|'engine';

export interface VoiceLogEntry {
 at:string;kind:VoiceLogKind;transcripts?:string[];final?:boolean;status?:string;reason?:string;error?:string;
 accepted?:boolean;direction?:'left'|'right';match?:'direct'|'correction';raceState?:string;camera?:string;selected?:number;
}

interface VoiceLogStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}

const STORAGE_KEY='duck-rush-voice-diagnostics-v1';
const MAX_ENTRIES=80;
const MAX_AGE_MS=24*60*60*1000;

export class VoiceLogStore {
 private logs:VoiceLogEntry[]=[];
 constructor(private readonly storage:VoiceLogStorage|null,private readonly now=()=>Date.now()){this.logs=this.read();}
 get entries():readonly VoiceLogEntry[]{return this.logs.map(entry=>({...entry,transcripts:entry.transcripts?[...entry.transcripts]:undefined}));}
 record(entry:Omit<VoiceLogEntry,'at'>){
  const transcripts=entry.transcripts?.slice(0,5).map(value=>value.slice(0,200));
  this.logs.push({...entry,...(transcripts?{transcripts}:{}),at:new Date(this.now()).toISOString()});
  this.logs=this.logs.slice(-MAX_ENTRIES);this.persist();
 }
 clear(){this.logs=[];try{this.storage?.removeItem(STORAGE_KEY);}catch(error){console.warn('[voice] diagnostics could not be cleared',{errorType:error instanceof Error?error.name:'unknown'});}}
 text(){return this.logs.map(entry=>JSON.stringify(entry)).join('\n');}
 private read():VoiceLogEntry[]{
  if(!this.storage)return [];
  try{
   const raw:unknown=JSON.parse(this.storage.getItem(STORAGE_KEY)||'[]');
   if(!Array.isArray(raw))return [];
   const cutoff=this.now()-MAX_AGE_MS;
   return raw.filter((entry):entry is VoiceLogEntry=>!!entry&&typeof entry==='object'&&typeof entry.at==='string'&&typeof entry.kind==='string'&&Date.parse(entry.at)>=cutoff).slice(-MAX_ENTRIES);
  }catch(error){console.warn('[voice] diagnostics could not be read',{errorType:error instanceof Error?error.name:'unknown'});return [];}
 }
 private persist(){if(!this.storage)return;try{this.storage.setItem(STORAGE_KEY,JSON.stringify(this.logs));}catch(error){console.warn('[voice] diagnostics could not be persisted',{errorType:error instanceof Error?error.name:'unknown'});}}
}

export function createVoiceLogStore(){let storage:Storage|null=null;try{storage=window.localStorage;}catch(error){console.warn('[voice] diagnostics storage unavailable',{errorType:error instanceof Error?error.name:'unknown'});}return new VoiceLogStore(storage);}
