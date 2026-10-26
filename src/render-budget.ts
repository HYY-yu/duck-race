export type RenderActivity='active'|'idle'|'paused';
/** Render pacing only. Race.step keeps its independent 60 Hz fixed timestep. */
export class RenderBudget {
 private nextFrame=0;private target=0;private nextShadow=0;
 frames=0;shadowUpdates=0;
 private windowStart=-1;private windowFrames=0;private workMs=0;
 fps=0;averageWorkMs=0;
 constructor(readonly mobile:boolean){}
 targetFps(activity:RenderActivity){return activity==='active'?(this.mobile?60:0):activity==='idle'?30:15;}
 shouldRender(now:number,activity:RenderActivity){
  // Active desktop scenes retain native cadence; idle/paused windows stop
  // competing with another race for the GPU. Physics keeps its fixed clock.
  const target=this.targetFps(activity);
  if(target===0){this.target=0;return true;}
  const interval=1000/target;
  if(target!==this.target){this.target=target;this.nextFrame=now;}
  if(now+.5<this.nextFrame)return false;
  // Preserve vsync phase rather than rounding a 33.34ms interval up to 50ms.
  this.nextFrame=now+interval-Math.max(0,now-this.nextFrame)%interval;
  return true;
 }
 shouldUpdateShadow(now:number,activity:RenderActivity){
  if(now+.5<this.nextShadow)return false;
  this.nextShadow=now+1000/(activity==='active'?30:15);return true;
 }
 reset(){this.nextFrame=0;this.target=0;this.nextShadow=0;this.windowStart=-1;this.windowFrames=0;this.workMs=0;this.fps=0;this.averageWorkMs=0;}
 record(now:number,workMs:number,shadowUpdated:boolean){
  this.frames++;if(shadowUpdated)this.shadowUpdates++;
  if(this.windowStart<0)this.windowStart=now;
  this.windowFrames++;this.workMs+=workMs;
  if(now-this.windowStart>=1000){this.fps=this.windowFrames*1000/(now-this.windowStart);this.averageWorkMs=this.workMs/this.windowFrames;this.windowStart=now;this.windowFrames=0;this.workMs=0;}
 }
 get diagnostics(){return {mobile:this.mobile,targetFps:this.target,frames:this.frames,fps:this.fps,averageWorkMs:this.averageWorkMs,shadowUpdates:this.shadowUpdates};}
}
