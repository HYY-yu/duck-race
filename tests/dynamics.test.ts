import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMotion,stepMotion,contactImpulse,waterline,type Body} from '../src/dynamics';
import {FALLS,sample} from '../src/track';
import {waterWave} from '../src/water-wave';

test('waterfall produces ballistic clearance and velocity-dependent entry',()=>{
 for(const fall of FALLS){const d:Body={s:fall.lip-.01,lane:.4,v:4.1,lv:0,...createMotion(fall.lip-.01,.4)};
 let clearance=0,minV=0,landed=false;let time=0;
 for(let i=0;i<180;i++){const old=d.s;d.s+=d.v/60;time+=1/60;const event=stepMotion(d,old,time,1/60);clearance=Math.max(clearance,d.y-waterline(d.s,d.lane,time));minV=Math.min(minV,d.vy);if(event?.kind==='landing'){assert.ok(event.strength>6);landed=true;break;}}
 assert.ok(landed);assert.ok(clearance>1.7);assert.ok(minV<-5);assert.equal(d.landings,1);assert.ok(d.y<waterline(d.s,d.lane,time));
 for(let i=0;i<360;i++){time+=1/60;stepMotion(d,d.s,time,1/60);}
 assert.ok(Math.abs(d.y-waterline(d.s,d.lane,time))<.16);
 }
});
test('an off-centre obstacle impulse causes recoil and angular motion',()=>{
 const d:Body={s:36,lane:1,v:4,lv:0,...createMotion(36,1)};contactImpulse(d,-6,3,1);
 assert.equal(d.v,-2);assert.equal(d.lv,3);assert.ok(Math.abs(d.yawV)>.5);assert.ok(Math.abs(d.rollV)>1);assert.ok(d.vy>0);
});
test('wave field fades at the shore, stays bounded and repeats without a phase jump',()=>{
 for(let s=0;s<200;s+=.4){assert.equal(waterWave(s,2,0,1),0);assert.ok(Math.abs(waterWave(s,0,4,1))<.14);assert.ok(Math.abs(waterWave(s,0,4,20)-waterWave(s,0,4,0))<1e-10);assert.ok(Number.isFinite(sample(s).y));}
});
