import * as THREE from 'three';
import {FALLS,sample,world} from './track';
import type {Race} from './simulation';
export function soundGain(distance:number,range=28){return 1/(1+(Math.max(0,distance)/range)**2);}
export function voiceCue(direction:-1|1){return direction<0?{startHz:560,endHz:360,pan:-.65}:{startHz:760,endHz:520,pan:.65};}
/** Deterministic procedural source, generated locally without media downloads. */
export function noiseSamples(size:number,seed=1949){
 const data=new Float32Array(size);let state=seed>>>0;
 for(let i=0;i<size;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;data[i]=(state/4294967296*2-1)*.65;}
 return data;
}
type WaterLoop={source:AudioBufferSourceNode;gain:GainNode;pan:StereoPannerNode;position:THREE.Vector3;level:number};
/** Lazy, opt-in Web Audio. The master limiter and voice cap bound busy collisions. */
export class AudioScene {
 enabled=false;available=true;private context?:AudioContext;private master?:GainNode;private noise?:AudioBuffer;
 private loops:WaterLoop[]=[];private voices=new Set<AudioScheduledSourceNode>();private seq=0;private generation=-1;private lastMechanical=-1;
 private direction=new THREE.Vector3();private right=new THREE.Vector3();
 async toggle(){
  if(!this.available)return;
  try{
   if(!this.context){
    if(!window.AudioContext){this.available=false;console.warn('[audio] Web Audio unavailable');return;}
    const context=this.context=new AudioContext(),master=this.master=context.createGain(),limiter=context.createDynamicsCompressor();
    master.gain.value=0;limiter.threshold.value=-18;limiter.knee.value=18;limiter.ratio.value=8;master.connect(limiter);limiter.connect(context.destination);
    const noise=this.noise=context.createBuffer(1,context.sampleRate*3,context.sampleRate);noise.copyToChannel(noiseSamples(noise.length),0);
    const sources=[{s:0,level:.19,hz:1500},...FALLS.map(f=>({s:f.impact,level:.32,hz:700}))];
    for(const water of sources){const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),pan=context.createStereoPanner(),p=sample(water.s);
     source.buffer=noise;source.loop=true;filter.type='lowpass';filter.frequency.value=water.hz;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(master);source.start();this.loops.push({source,gain,pan,position:new THREE.Vector3(p.x,p.y,p.z),level:water.level});}
   }
   const next=!this.enabled;if(next)await this.context.resume();this.enabled=next;
   this.master!.gain.setTargetAtTime(next?.5:0,this.context.currentTime,.08);
   console.info('[audio] preference changed',{enabled:this.enabled,state:this.context.state});
  }catch(error){this.enabled=false;console.warn('[audio] activation failed',error);}
 }
 async visibility(visible:boolean){
  if(!this.context)return;
  try{if(!visible)await this.context.suspend();else if(this.enabled)await this.context.resume();}
  catch(error){console.warn('[audio] visibility update failed',error);}
 }
 command(direction:-1|1){
  const context=this.context;if(!this.enabled||context?.state!=='running'||!this.master||this.voices.size>=12)return;
  const cue=voiceCue(direction),now=context.currentTime,duration=.22,oscillator=context.createOscillator(),gain=context.createGain(),pan=context.createStereoPanner();
  oscillator.type='triangle';oscillator.frequency.setValueAtTime(cue.startHz,now);oscillator.frequency.exponentialRampToValueAtTime(cue.endHz,now+duration);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.16,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);pan.pan.value=cue.pan;
  oscillator.connect(gain);gain.connect(pan);pan.connect(this.master);this.voices.add(oscillator);
  oscillator.onended=()=>{this.voices.delete(oscillator);oscillator.disconnect();gain.disconnect();pan.disconnect();};oscillator.start(now);oscillator.stop(now+duration+.02);
  console.debug('[audio] voice acknowledgement',{direction:direction<0?'left':'right'});
 }
 private spatial(position:THREE.Vector3,camera:THREE.Camera){
  this.direction.subVectors(position,camera.position);const distance=this.direction.length();this.right.setFromMatrixColumn(camera.matrixWorld,0);
  return {gain:soundGain(distance),pan:THREE.MathUtils.clamp(this.direction.dot(this.right)/Math.max(18,distance),-1,1)};
 }
 private burst(kind:'contact'|'landing'|'wood',strength:number,position:THREE.Vector3,camera:THREE.Camera){
  const context=this.context;if(!context||!this.master||!this.noise||this.voices.size>=12)return;
  const now=context.currentTime,spatial=this.spatial(position,camera),gain=context.createGain(),pan=context.createStereoPanner();pan.pan.value=spatial.pan;
  const duration=kind==='landing'?.65:kind==='wood'?.12:.23,volume=(kind==='wood'?.065:.22)*Math.min(1.4,strength/7)*spatial.gain;
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);gain.connect(pan);pan.connect(this.master);
  let source:AudioScheduledSourceNode;let filter:BiquadFilterNode|undefined;
  if(kind==='landing'){const noise=context.createBufferSource();noise.buffer=this.noise;filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(2400,now);filter.frequency.exponentialRampToValueAtTime(250,now+duration);noise.connect(filter);filter.connect(gain);source=noise;}
  else{const oscillator=context.createOscillator();oscillator.type='sine';oscillator.frequency.setValueAtTime(kind==='wood'?210:320,now);oscillator.frequency.exponentialRampToValueAtTime(90,now+duration);oscillator.connect(gain);source=oscillator;}
  this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();filter?.disconnect();gain.disconnect();pan.disconnect();};source.start();source.stop(now+duration+.02);
 }
 update(camera:THREE.Camera,race:Race,visible:boolean){
  if(race.generation!==this.generation){this.generation=race.generation;this.seq=race.events.at(-1)?.seq??0;this.lastMechanical=-1;for(const source of this.voices)source.stop();this.voices.clear();}
  const context=this.context,playing=visible&&this.enabled&&context?.state==='running';
  if(context)for(const loop of this.loops){const spatial=this.spatial(loop.position,camera);loop.gain.gain.setTargetAtTime(playing?loop.level*spatial.gain:0,context.currentTime,.18);loop.pan.pan.setTargetAtTime(spatial.pan,context.currentTime,.18);}
  for(const event of race.events){if(event.seq<=this.seq)continue;this.seq=event.seq;if(!playing||race.time-event.time>.15||event.kind==='takeoff')continue;const p=world(event.s,event.lane);this.burst(event.kind,event.strength,new THREE.Vector3(p.x,event.y,p.z),camera);}
  if(playing&&race.state==='racing'){
   const beat=Math.floor(race.time*.9/(Math.PI/2));if(beat!==this.lastMechanical){this.lastMechanical=beat;const p=sample(77);this.burst('wood',4,new THREE.Vector3(p.x,p.y+1,p.z),camera);}
  }
 }
 get diagnostics(){return {enabled:this.enabled,context:this.context?.state??'uninitialized',voices:this.voices.size,loops:this.loops.length};}
}
