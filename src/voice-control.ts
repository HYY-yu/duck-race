export type VoiceDirection=-1|1;
export interface VoiceDirectionMatch {direction:VoiceDirection;source:'direct'|'correction';candidate:number;}

const directDirectionOf=(value:string):VoiceDirection|null=>{
 const text=value.normalize('NFKC').toLocaleLowerCase();
 const words=text.replace(/[\p{P}\p{S}\s]/gu,'');
 const left=/(?:向|往|朝)?左(?:边|侧|面|手边)?/.test(text)||words.includes('left');
 const right=/(?:向|往|朝)?右(?:边|侧|面|手边)?/.test(text)||words.includes('right');
 return left===right?null:left?-1:1;
};

const correctedDirectionOf=(value:string):VoiceDirection|null=>{
 const words=value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
 if(['王者','王者王','王座'].includes(words))return -1;
 if(words==='我要')return 1;
 return null;
};

/** Prefer literal direction words across all candidates before applying observed speech corrections. */
export function matchVoiceDirection(transcripts:readonly string[]):VoiceDirectionMatch|null{
 for(let candidate=0;candidate<transcripts.length;candidate++){const direction=directDirectionOf(transcripts[candidate]);if(direction!==null)return {direction,source:'direct',candidate};}
 for(let candidate=0;candidate<transcripts.length;candidate++){const direction=correctedDirectionOf(transcripts[candidate]);if(direction!==null)return {direction,source:'correction',candidate};}
 return null;
}

/** Resolve the first unambiguous direction from the recognition n-best list. */
export function parseVoiceDirection(transcripts:readonly string[]):VoiceDirection|null{
 return matchVoiceDirection(transcripts)?.direction??null;
}

interface RecognitionAlternative {transcript:string;}
interface RecognitionResult {isFinal:boolean;length:number;[index:number]:RecognitionAlternative;}
interface RecognitionEvent {resultIndex:number;results:{length:number;[index:number]:RecognitionResult};}
interface RecognitionErrorEvent {error:string;}
interface RecognitionLike {
 continuous:boolean;interimResults:boolean;lang:string;maxAlternatives:number;
 onstart:(event:Event)=>void;onend:(event:Event)=>void;onerror:(event:RecognitionErrorEvent)=>void;onresult:(event:RecognitionEvent)=>void;
 start():void;stop():void;
}
type RecognitionConstructor=new()=>RecognitionLike;
export type VoiceStatus='idle'|'starting'|'listening'|'unsupported'|'error';
export interface VoiceEngineDiagnostic {kind:'error'|'cycle'|'start-deferred'|'stop-skipped';value:string;}

export class VoiceControl {
 private recognition:RecognitionLike|null=null;
 private wanted=false;
 private restartTimer:number|null=null;
 constructor(private readonly onTranscript:(transcripts:readonly string[],isFinal:boolean)=>void,private readonly onStatus:(status:VoiceStatus)=>void,RecognitionOverride?:RecognitionConstructor,private readonly onDiagnostic:(event:VoiceEngineDiagnostic)=>void=()=>{}){
  const Recognition=RecognitionOverride??(()=>{const scope=window as typeof window&{SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};return scope.SpeechRecognition??scope.webkitSpeechRecognition;})();
  if(!Recognition){this.onStatus('unsupported');return;}
  // Single-utterance sessions finalize faster and work in more WebKit/Chromium variants.
  // The controller restarts after each utterance while voice control remains enabled.
  const recognition=this.recognition=new Recognition();recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=5;
  recognition.onstart=()=>this.onStatus('listening');
  recognition.onresult=event=>{for(let i=event.resultIndex;i<event.results.length;i++){const result=event.results[i],transcripts=Array.from({length:result.length},(_,index)=>result[index]?.transcript).filter((value):value is string=>!!value);if(transcripts.length)this.onTranscript(transcripts,result.isFinal);}};
  recognition.onerror=event=>{
   const terminal=['not-allowed','service-not-allowed','audio-capture'].includes(event.error);
   if(terminal)this.wanted=false;
   const expected=['no-speech','aborted'].includes(event.error);
   this.onDiagnostic({kind:expected?'cycle':'error',value:event.error});
   if(expected)console.debug('[voice] recognition cycle ended',{reason:event.error});
   else console.warn('[voice] recognition error',{error:event.error,terminal});
   if(!expected)this.onStatus('error');
  };
  recognition.onend=()=>{if(this.wanted&&!document.hidden){this.onStatus('starting');this.scheduleRestart();}else this.onStatus('idle');};
 }
 get available(){return this.recognition!==null;}
 get enabled(){return this.wanted;}
 setLanguage(language:'zh'|'en'){if(this.recognition)this.recognition.lang=language==='zh'?'zh-CN':'en-US';}
 toggle(){this.wanted?this.stop():this.start();}
 start(){
  if(!this.recognition){this.onStatus('unsupported');return;}
  this.wanted=true;this.clearRestart();this.onStatus('starting');
  try{this.recognition.start();}catch(error){const value=error instanceof Error?error.name:'unknown';this.onDiagnostic({kind:'start-deferred',value});console.debug('[voice] recognition start deferred',{errorType:value});this.scheduleRestart();}
 }
 stop(){this.wanted=false;this.clearRestart();if(!this.recognition)return;try{this.recognition.stop();}catch(error){const value=error instanceof Error?error.name:'unknown';this.onDiagnostic({kind:'stop-skipped',value});console.debug('[voice] recognition stop skipped',{errorType:value});}this.onStatus('idle');}
 visibility(hidden:boolean){if(hidden){this.clearRestart();if(this.wanted)try{this.recognition?.stop();}catch(error){console.debug('[voice] recognition already stopped',{errorType:error instanceof Error?error.name:'unknown'});}}else if(this.wanted)this.scheduleRestart();}
 private scheduleRestart(){this.clearRestart();this.restartTimer=window.setTimeout(()=>{this.restartTimer=null;if(this.wanted&&!document.hidden)this.start();},150);}
 private clearRestart(){if(this.restartTimer!==null){window.clearTimeout(this.restartTimer);this.restartTimer=null;}}
}
