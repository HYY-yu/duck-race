/// <reference types="vite/client" />
import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {World} from '../world';
import {Race} from '../simulation';
import {sample,world,MOUNTAIN_COURSE,COURSE_SCALE} from '../track';
import {FollowCamera,stableLookAt} from '../follow-camera';
import {RaceFeedback} from '../race-feedback';
import {AudioScene} from '../audio-scene';
import {RenderBudget} from '../render-budget';
import {DuckNameBubbles} from '../duck-name-bubbles';
import {copy,duckLabel,DUCK_COLORS,touchHint,type Language} from './copy';
import {SteeringInput,STEERING_KEYS} from './input';
import {playablesSDK,reportError} from './platform';

// This entry never imports the website entry, PostHog adapter, name picker or voice engine.
const app=document.querySelector<HTMLDivElement>('#app')!;
const sdk=playablesSDK();
let language:Language='en',selected=0,view:'follow'|'overview'='follow';
let platformPaused=false,contextLost=false,firstFrame=false,finishedGeneration=-1;
let renderedResults='';
let frame=0,last=performance.now(),accumulator=0,elapsed=0,lastUI=0;
const input=new SteeringInput(),race=new Race(12,42),feedback=new RaceFeedback();
const audio=new AudioScene(),budget=new RenderBudget(matchMedia('(pointer: coarse)').matches);
const followCamera=new FollowCamera(true),target=new THREE.Vector3();
const text=()=>copy[language];
app.innerHTML=`<div id="scene"></div>
 <header class="top"><div class="brand">duck rush<span>.</span></div><div class="tools">
 <button id="camera" type="button"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c5 5 5 11 0 16-5-5-5-11 0-16Z"/></svg><span class="tool-label"></span></button>
 <button id="sound" type="button" ${sdk?'hidden':''}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4ZM15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/></svg><span class="tool-label"></span></button>
 <select id="language"><option value="en">EN</option><option value="zh">中文</option></select></div></header>
 <div id="status" class="status" role="status" aria-live="polite"></div>
 <section class="panel" aria-labelledby="choose-title"><h1 id="choose-title"></h1><p class="hint" id="hint"></p>
 <div class="choices" role="group" id="choices">${DUCK_COLORS.map((color,id)=>`<button type="button" class="duck-choice" data-duck="${id}" aria-pressed="${id===selected}"><span class="swatch" style="background:${color}" aria-hidden="true"></span><span class="number">${String(id+1).padStart(2,'0')}</span></button>`).join('')}</div>
 <p class="selected" id="selected"></p><h2 class="results-title" id="results-title" hidden></h2><ol class="results" id="results" hidden></ol>
 <button class="primary" id="action" type="button"></button></section>
 <div id="keys" class="keys"></div><div class="steering" id="steering" role="group">
 <button type="button" data-direction="-1" aria-pressed="false">←</button><button type="button" data-direction="1" aria-pressed="false">→</button></div>
 <div class="countdown" id="countdown" aria-hidden="true"></div>`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let renderer:THREE.WebGLRenderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}
catch(error){reportError(error);app.innerHTML=`<p class="error" role="alert">${text().error}</p>`;throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.transmissionResolutionScale=.5;
el('scene').appendChild(renderer.domElement);
const worldView=new World(renderer);worldView.setDucks(12,DUCK_COLORS);
const labels=new DuckNameBubbles();labels.bind(el('scene'),DUCK_COLORS.map((_,id)=>String(id+1).padStart(2,'0')),DUCK_COLORS);
const camera=new THREE.PerspectiveCamera(62,1,.1,1000);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI*.47;orbit.minDistance=12;orbit.maxDistance=500;

function releaseInput(){input.clear();race.setSteering(-1,0);paintInput();}
function canSteer(){return !platformPaused&&!contextLost&&race.state==='racing'&&race.ducks[selected].finish===null;}
function paintInput(){document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button=>{
 button.disabled=!canSteer();button.setAttribute('aria-pressed',String(canSteer()&&input.axis===Number(button.dataset.direction)));
});}
function placeCamera(){
 followCamera.reset();const duck=race.ducks[selected],p=world(duck.s,duck.lane),dir=sample(duck.s);
 if(view==='follow'){
  camera.position.set(p.x-dir.tx*10-dir.tz,duck.y+6,p.z-dir.tz*10+dir.tx);target.set(p.x,duck.y+1,p.z);camera.lookAt(target);camera.fov=62;
 }else{
  camera.fov=45;camera.position.set(111,106,145).multiplyScalar(COURSE_SCALE);
  if(MOUNTAIN_COURSE){const start=sample(0),angle=Math.atan2(start.z,start.x);camera.position.set(Math.cos(angle)*340,280,Math.sin(angle)*340);}
  orbit.target.set(0,13,-4*COURSE_SCALE);orbit.update();
 }
 orbit.enabled=view==='overview'&&!platformPaused;camera.updateProjectionMatrix();
}
function paintCopy(){
 const t=text();document.documentElement.lang=language;
 el('choose-title').textContent=t.choose;el('hint').textContent=t.hint;
 el('keys').innerHTML=`<span class="keyboard-hint">${t.keys}</span><span class="touch-hint">${touchHint[language]}</span>`;
 el('choices').setAttribute('aria-label',t.choose);el('language').setAttribute('aria-label',t.language);
 el('steering').setAttribute('aria-label',t.keys);el<HTMLSelectElement>('language').value=language;
 el('sound').querySelector('.tool-label')!.textContent=t.sound;el('sound').setAttribute('aria-label',t.sound);el('sound').title=t.sound;el('results-title').textContent=t.results;
 document.querySelectorAll<HTMLButtonElement>('.duck-choice').forEach(button=>{
  const id=Number(button.dataset.duck);button.setAttribute('aria-label',duckLabel(id,language));button.title=duckLabel(id,language);
 });
 document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button=>button.setAttribute('aria-label',Number(button.dataset.direction)<0?t.left:t.right));
 paintUI();
}
function paintUI(){
 const t=text(),playing=['countdown','racing','paused'].includes(race.state),finished=race.state==='finished';
 app.classList.toggle('playing',playing);
 app.classList.toggle('finished',finished);
 el('steering').hidden=!playing;el('keys').hidden=!playing;
 el('selected').textContent=`${t.you}: ${duckLabel(selected,language)}`;
 const cameraLabel=view==='follow'?t.overview:t.follow;
 el('camera').querySelector('.tool-label')!.textContent=cameraLabel;el('camera').setAttribute('aria-label',cameraLabel);el('camera').title=cameraLabel;
 const action=el<HTMLButtonElement>('action');action.textContent=race.state==='ready'?t.start:finished?t.again:race.state==='paused'?t.resume:t.pause;
 action.disabled=platformPaused||contextLost;
 document.querySelectorAll<HTMLButtonElement>('.duck-choice').forEach(button=>{button.disabled=playing||platformPaused||contextLost;button.setAttribute('aria-pressed',String(Number(button.dataset.duck)===selected));});
 document.querySelectorAll<HTMLElement>('.duck-name-bubble').forEach(label=>label.dataset.player=String(Number(label.dataset.duck)===selected));
 const rank=[...race.ducks].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.s-a.s).findIndex(d=>d.id===selected)+1;
 const phase=platformPaused||race.state==='paused'?t.paused:finished?t.finished:race.state==='ready'?t.ready:t.racing;
 el('status').textContent=phase+(race.state!=='ready'?` · ${t.position} ${rank} / 12`:'')+(race.ducks[selected].finish!==null&&!finished?`\n${t.waiting}`:'');
 el('countdown').textContent=race.state==='countdown'?String(Math.max(1,Math.ceil(race.countdown))):'';
 el('results').hidden=!finished;el('results-title').hidden=!finished;
 // Preserve the ranking scroll position while the scene continues rendering.
 const resultKey=`${race.generation}:${language}:${selected}`;
 if(finished&&renderedResults!==resultKey){
  el('results').innerHTML=race.results.map((duck,i)=>`<li data-player="${duck.id===selected}"><span>${i+1}</span><span class="swatch" style="background:${DUCK_COLORS[duck.id]}" aria-hidden="true"></span><span>${duckLabel(duck.id,language)}</span><span>${duck.finish?.toFixed(2)}s</span></li>`).join('');
  renderedResults=resultKey;el('results').scrollTop=0;
 }
 paintInput();
}
function enableAudio(){if(!platformPaused)void audio.setEnabled(sdk?sdk.system.isAudioEnabled():audio.enabled);}
function action(){
 if(platformPaused||contextLost)return;
 releaseInput();
 if(race.state==='finished'){
  race.reset(12,42);feedback.update(race);view='follow';placeCamera();paintUI();
  console.info('[youtube] returned to duck selection');return;
 }
 if(race.state==='ready'){
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];race.reset(12,seed);feedback.update(race);view='follow';placeCamera();race.start();
  // Metrics hook: controlled duck ID and race phase only; no names, URLs or identifiers.
  console.info('[youtube] race started',{duck:selected,seed});enableAudio();
 }else{race.pause();void audio.visibility(race.state!=='paused');console.info('[youtube] race pause changed',{state:race.state});}
 paintUI();
}
el('action').addEventListener('click',action);
el('choices').addEventListener('click',event=>{
 const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-duck]');if(!button||button.disabled)return;
 selected=Number(button.dataset.duck);releaseInput();placeCamera();paintUI();console.debug('[youtube] duck selected',{duck:selected});
});
el('camera').addEventListener('click',()=>{if(platformPaused)return;view=view==='follow'?'overview':'follow';placeCamera();paintUI();});
el('language').addEventListener('change',()=>{language=el<HTMLSelectElement>('language').value==='zh'?'zh':'en';paintCopy();});
el('sound').addEventListener('click',()=>{if(!platformPaused)void audio.toggle().then(()=>el('sound').setAttribute('aria-pressed',String(audio.enabled)));});
document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button=>{
 button.addEventListener('pointerdown',event=>{
  if(!canSteer()||event.button!==0)return;event.preventDefault();button.setPointerCapture(event.pointerId);
  input.press(`pointer:${event.pointerId}`,Number(button.dataset.direction));paintInput();
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{input.release(`pointer:${(event as PointerEvent).pointerId}`);paintInput();});
 button.addEventListener('contextmenu',event=>event.preventDefault());
});
document.addEventListener('keydown',event=>{
 if(/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName))return;
 const direction=STEERING_KEYS.get(event.code);
 if(direction!==undefined&&canSteer()){event.preventDefault();input.press(`key:${event.code}`,direction);paintInput();}
 if(event.code==='Space'&&!event.repeat&&(event.target as HTMLElement)?.tagName!=='BUTTON'){event.preventDefault();action();}
});
document.addEventListener('keyup',event=>{input.release(`key:${event.code}`);paintInput();});
window.addEventListener('blur',releaseInput);
function pausePlatform(){
 if(platformPaused)return;platformPaused=true;cancelAnimationFrame(frame);releaseInput();orbit.enabled=false;
 void audio.visibility(false);paintUI();console.info('[youtube] platform paused');
}
function resumePlatform(){
 if(!platformPaused||contextLost)return;platformPaused=false;last=performance.now();accumulator=0;budget.reset();orbit.enabled=view==='overview';
 void audio.visibility(race.state!=='paused');enableAudio();paintUI();frame=requestAnimationFrame(tick);console.info('[youtube] platform resumed');
}
if(sdk){
 sdk.system.onPause(pausePlatform);sdk.system.onResume(resumePlatform);
 sdk.system.onAudioEnabledChange(enabled=>{if(!platformPaused)void audio.setEnabled(enabled);});
 void sdk.system.getLanguage().then(value=>{language=value.toLowerCase().startsWith('zh')?'zh':'en';paintCopy();}).catch(reportError);
}else{
 console.info('[youtube] local preview; Playables SDK environment unavailable');
 // Only local previews use browser visibility. Hosted Playables use SDK lifecycle exclusively.
 document.addEventListener('visibilitychange',()=>document.hidden?pausePlatform():resumePlatform());
}
renderer.domElement.addEventListener('webglcontextlost',event=>{
 event.preventDefault();contextLost=true;pausePlatform();cancelAnimationFrame(frame);releaseInput();
 if(race.state==='racing'||race.state==='countdown')race.pause();
 reportError(new Error('WebGL context lost'));el('status').textContent=text().context;
});
renderer.domElement.addEventListener('webglcontextrestored',()=>{console.warn('[youtube] context restored; reload required');el('status').textContent=text().context;});
function resize(){
 const {width,height}=app.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();
 labels.measure();
}
window.addEventListener('resize',resize);
function tick(now:number){
 if(platformPaused||contextLost)return;frame=requestAnimationFrame(tick);
 const activity=race.state==='racing'||race.state==='countdown'?'active':race.state==='paused'?'paused':'idle';
 if(!budget.shouldRender(now,activity))return;
 const workStart=performance.now(),delta=Math.min(.1,(now-last)/1000);last=now;
 elapsed+=delta;accumulator+=delta;
 race.setSteering(canSteer()?selected:-1,canSteer()?input.axis:0);
 while(accumulator>=1/60){race.step(1/60);accumulator-=1/60;}
 if(!canSteer())releaseInput();
 feedback.update(race);worldView.update(elapsed,race,feedback.hits);
 if(view==='follow'){
  const duck=race.ducks[selected],p=world(duck.s,duck.lane),dir=sample(duck.s);target.set(p.x,duck.y+1,p.z);
  followCamera.update(camera,target,dir.tx,dir.tz,delta,worldView.clearCameraView,0,(x,z)=>worldView.height(x,z),duck.v);
  stableLookAt(camera,target,delta,6);
 }else orbit.update();
 const updateShadow=budget.shouldUpdateShadow(now,activity);renderer.shadowMap.needsUpdate=updateShadow;
 renderer.render(worldView.scene,camera);audio.update(camera,race,race.state!=='paused');
 labels.update(camera,worldView.duckMeshes.map((mesh,id)=>({id,position:mesh.position})),app.clientWidth,app.clientHeight);
 if(!firstFrame){firstFrame=true;sdk?.game.firstFrameReady();sdk?.game.gameReady();console.info('[youtube] game ready',{course:MOUNTAIN_COURSE?'mountain':'long'});}
 if(race.state==='finished'&&finishedGeneration!==race.generation){finishedGeneration=race.generation;releaseInput();console.info('[youtube] race finished',{duck:selected,time:race.time,controlled:race.controlled});paintUI();}
 if(now-lastUI>100){paintUI();lastUI=now;}
 budget.record(now,performance.now()-workStart,updateShadow);
}
// Read-only diagnostics for preview acceptance; no external analytics adapter is installed.
Object.defineProperty(window,'__DUCK_RUSH_YOUTUBE__',{get:()=>({state:race.state,selected,axis:race.steering.axis,controlled:race.controlled,platformPaused,language,view,time:race.time,frames:budget.frames,ducks:race.ducks.map(d=>({id:d.id,lane:d.lane,s:d.s,finish:d.finish})),assets:worldView.generatedStage})});
window.addEventListener('error',event=>reportError(event.error??event.message));
window.addEventListener('unhandledrejection',event=>reportError(event.reason));
paintCopy();placeCamera();resize();frame=requestAnimationFrame(tick);
