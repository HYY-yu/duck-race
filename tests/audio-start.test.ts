import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioScene} from '../src/audio-scene';

test('starting another draw enables audio idempotently and reuses its context and loops',async t=>{
 const restore=['window','AudioContext'].map(key=>({key,descriptor:Object.getOwnPropertyDescriptor(globalThis,key)}));
 t.after(()=>{for(const {key,descriptor}of restore){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
 const parameter=()=>({value:0,setTargetAtTime(value:number){this.value=value;}});
 const node=()=>({connect(){},gain:parameter(),frequency:parameter(),threshold:parameter(),knee:parameter(),ratio:parameter()});
 let contexts=0,resumes=0;
 class FakeAudioContext {
  state='suspended';sampleRate=8;currentTime=0;destination={};
  constructor(){contexts++;}
  createGain(){return node();}createDynamicsCompressor(){return node();}createBiquadFilter(){return node();}createStereoPanner(){return node();}
  createBuffer(_channels:number,length:number){return {length,copyToChannel(){}};}
  createBufferSource(){return {...node(),start(){}};}
  async resume(){resumes++;this.state='running';}
 }
 Object.defineProperty(globalThis,'window',{configurable:true,value:{AudioContext:FakeAudioContext}});
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:FakeAudioContext});
 const audio=new AudioScene();assert.equal(contexts,0);
 await audio.setEnabled(true);assert.equal(audio.enabled,true);assert.equal(audio.diagnostics.context,'running');
 const loops=audio.diagnostics.loops;assert.ok(loops>0);
 await audio.setEnabled(true);assert.equal(audio.enabled,true);assert.equal(resumes,1);assert.equal(contexts,1);assert.equal(audio.diagnostics.loops,loops);
 await audio.toggle();assert.equal(audio.enabled,false);
 await audio.setEnabled(true);assert.equal(audio.enabled,true);assert.equal(contexts,1);assert.equal(audio.diagnostics.loops,loops);
});
