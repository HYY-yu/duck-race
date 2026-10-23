import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrafficCone} from '../src/traffic-cone';
import {Race} from '../src/simulation';
import {createMotion} from '../src/dynamics';

test('cone falls once, waits for clearance, and restores upright',()=>{
 const c=new TrafficCone();assert.equal(c.knock(3,4),true);assert.equal(c.knock(-1,0),false);
 assert.equal(c.along,.6);assert.equal(c.lateral,.8);
 for(let i=0;i<240;i++)c.step(1/60,true);
 assert.equal(c.upright,false);assert.equal(c.tilt,1.48);
 for(let i=0;i<60;i++)c.step(1/60,false);
 assert.equal(c.upright,true);assert.equal(c.tilt,0);
});

test('duck contact tips cone, dissipates speed, and emits contact; pause/reset preserve lifecycle',()=>{
 const r=new Race(2,42);r.state='racing';
 const d=r.ducks[0],s=r.cone.s-1;Object.assign(d,{s,lane:0,v:4,lv:0,...createMotion(s,0)});
 r.step(1/60);assert.equal(r.cone.upright,false);assert.equal(d.hits,1);assert.ok(d.v<4);
 assert.ok(r.events.some(e=>e.kind==='contact'&&e.duck===d.id));
 r.pause();const elapsed=r.cone.elapsed;for(let i=0;i<300;i++)r.step(1/60);assert.equal(r.cone.elapsed,elapsed);
 r.reset(2,42);assert.equal(r.cone.upright,true);assert.equal(r.cone.tilt,0);
});

test('airborne duck passing over cone does not knock it down',()=>{
 const r=new Race(2,42);r.state='racing';
 Object.assign(r.ducks[0],{s:r.cone.s-1,lane:0,v:4,y:50,airborne:true,lastFall:0});
 r.step(1/60);assert.equal(r.cone.upright,true);
});
