import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderBudget,type RenderActivity} from '../src/render-budget';

for(const refresh of [60,90,120])for(const [activity,target]of [['active',60],['idle',30],['paused',15]]as const){
 test(`mobile ${activity} pacing stays near ${target} fps on a ${refresh} Hz screen`,()=>{
  const budget=new RenderBudget(true);let rendered=0;
  for(let frame=0;frame<refresh*6;frame++)if(budget.shouldRender(frame*1000/refresh,activity))rendered++;
  assert.ok(Math.abs(rendered-target*6)<=1,`${rendered} rendered frames`);
 });
}

test('desktop retains native refresh cadence and activity changes respond immediately',()=>{
 const desktop=new RenderBudget(false);
 assert.equal(desktop.targetFps('active'),0);assert.equal(desktop.targetFps('idle'),30);assert.equal(desktop.targetFps('paused'),15);
 for(let frame=0;frame<240;frame++)assert.equal(desktop.shouldRender(frame*1000/120,'active'),true);
 const mobile=new RenderBudget(true);
 assert.equal(mobile.shouldRender(0,'paused'),true);
 assert.equal(mobile.shouldRender(10,'paused'),false);
 assert.equal(mobile.shouldRender(11,'active'),true);
 mobile.reset();assert.equal(mobile.shouldRender(12,'active'),true);
});

test('render pacing preserves the same fixed-step simulation time across activity budgets',()=>{
 for(const activity of ['active','idle','paused']as const){
  const budget=new RenderBudget(true);let last=0,accumulator=0,steps=0;
  for(let frame=0;frame<=600;frame++){
   const now=frame*1000/60;if(!budget.shouldRender(now,activity))continue;
   accumulator+=(now-last)/1000;last=now;
   while(accumulator+1e-10>=1/60){steps++;accumulator-=1/60;}
  }
  assert.equal(steps,600,activity);
 }
});

test('shadow pacing budgets mobile and desktop without limiting native color frames',()=>{
 const budget=new RenderBudget(true);let updates=0;
 for(let frame=0;frame<360;frame++)if(budget.shouldUpdateShadow(frame*1000/60,'active'))updates++;
 assert.ok(Math.abs(updates-180)<=1);
 for(const mobile of [false,true])for(const activity of ['active','idle','paused']as const){
  const b=new RenderBudget(mobile);let count=0;
  for(let frame=0;frame<720;frame++)if(b.shouldUpdateShadow(frame*1000/120,activity))count++;
  assert.ok(Math.abs(count-(activity==='active'?180:90))<=1,`${mobile} ${activity}: ${count}`);
 }
});

for(const activity of ['idle','paused']as const)test(`desktop ${activity} scene yields GPU time and resumes native cadence immediately`,()=>{
 const budget=new RenderBudget(false),target=activity==='idle'?30:15;let frames=0;
 for(let i=0;i<720;i++)if(budget.shouldRender(i*1000/120,activity))frames++;
 assert.ok(Math.abs(frames-target*6)<=1);
 assert.equal(budget.shouldRender(6001,'active'),true);assert.equal(budget.shouldRender(6002,'active'),true);
});
