/** Read-only Android Chrome benchmark. Requires adb forwarding chrome_devtools_remote. */
import {writeFile} from 'node:fs/promises';

const seconds=Number(process.argv[3]??15),port=Number(process.env.ANDROID_CDP_PORT??9222);
if(!Number.isFinite(seconds)||seconds<3||seconds>60)throw new Error('Sample duration must be 3–60 seconds.');
const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target=targets.find(t=>t.type==='page'&&/^(https?:\/\/)(localhost|127\.0\.0\.1|duckracepicker\.com)([:/]|$)/.test(t.url));
if(!target)throw new Error('Open Duck Rush in Android Chrome first.');
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let sequence=0;const pending=new Map();
socket.onmessage=({data})=>{
 const response=JSON.parse(data),request=pending.get(response.id);if(!request)return;
 pending.delete(response.id);clearTimeout(request.timer);
 if(response.error)request.reject(new Error(JSON.stringify(response.error)));else request.resolve(response.result);
};
function send(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timed out: ${method}`));},(seconds+15)*1000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
 });
}
const evaluate=async expression=>{
 const {result,exceptionDetails}=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(exceptionDetails)throw new Error(JSON.stringify(exceptionDetails));return result.value;
};
const metrics=response=>Object.fromEntries(response.metrics.map(m=>[m.name,m.value]));
try{
 const ready=await evaluate('!!window.__DUCK_RUSH__ && document.visibilityState === "visible"');
 if(!ready)throw new Error('Keep the loaded Duck Rush page in the foreground.');
 await send('Performance.enable');const before=metrics(await send('Performance.getMetrics'));
 const result=await evaluate(`new Promise(resolve=>{
  let first=0,last=0;const samples=[],before=window.__DUCK_RUSH__.performance;
  function frame(now){
   if(!first)first=last=now;else{samples.push(now-last);last=now;}
   if(now-first<${seconds*1000}){requestAnimationFrame(frame);return;}
   const durationMs=now-first,sorted=[...samples].sort((a,b)=>a-b),game=window.__DUCK_RUSH__,render=game.performance;
   resolve({durationMs,rafFps:samples.length*1000/durationMs,renderFps:before?(render.frames-before.frames)*1000/durationMs:null,
    rafP95Ms:sorted[Math.floor(sorted.length*.95)],shadowUpdatesPerSecond:before?(render.shadowUpdates-before.shadowUpdates)*1000/durationMs:null,
    course:game.course,seed:game.seed,state:game.state,raceTime:game.time,entries:game.entryCount,drawCalls:game.drawCalls,triangles:game.triangles,
    generatedAssetsReady:game.generatedAssets.ready,audio:game.audio,render,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},userAgent:navigator.userAgent});
  }requestAnimationFrame(frame);
 })`);
 const after=metrics(await send('Performance.getMetrics'));
 result.browser={taskTimeMs:(after.TaskDuration-before.TaskDuration)*1000,scriptTimeMs:(after.ScriptDuration-before.ScriptDuration)*1000,layoutTimeMs:(after.LayoutDuration-before.LayoutDuration)*1000,heapUsedMB:after.JSHeapUsedSize/1048576};
 const output=JSON.stringify(result,null,2);console.log(output);
 if(process.argv[2])await writeFile(process.argv[2],output+'\n');
}finally{
 for(const request of pending.values())clearTimeout(request.timer);
 socket.close();
}
