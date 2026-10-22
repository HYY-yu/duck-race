import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HEADWATER, FORKS, RIVER_REACHES, sampleChannel, sampleCourse, bankDistanceAt } from '../src/course.ts';
import { createDucks, step, landingOffset } from '../src/simulation.ts';
import { RaceController } from '../src/race.ts';
import { waterWave } from '../src/water-wave.ts';
import { createRiverWater } from '../src/water.ts';
import { createHeadwaterFall } from '../src/waterfall.ts';

test('all split and merge edge vertices agree in position, normal, optical depth and animated height', t => {
  const scene=new THREE.Scene(),water=createRiverWater(scene);t.after(()=>water.dispose());
  for(const fork of FORKS)for(const s of [fork.start,fork.end]){
    const reaches=RIVER_REACHES.filter(r=>r.start===s||r.end===s);
    const main=reaches.find(r=>r.route==='main');
    const read=(reach)=>{
      const g=scene.getObjectByName(`water-${reach.route}-${reach.start}`).geometry;
      const a=g.attributes,at=[];
      for(let i=0;i<a.position.count;i++)if(Math.abs(a.uv.getY(i)-s)<1e-4){
        at.push({x:a.position.getX(i),y:a.position.getY(i),z:a.position.getZ(i),n:[a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i)],
          lateral:a.riverShore.getZ(i),bank:a.riverBankDistance.getX(i),speed:a.riverData.getX(i),depth:a.riverData.getY(i)});
      }return at;
    };
    const full=read(main);
    for(const branch of reaches.filter(r=>r.route!=='main'))for(const v of read(branch)){
      const match=full.find(p=>Math.hypot(p.x-v.x,p.z-v.z)<1e-5);assert.ok(match,`no T-junction at ${s}`);
      for(const key of ['y','bank','speed','depth'])assert.ok(Math.abs(match[key]-v[key])<1e-5,`${key} agrees at ${s}`);
      assert.ok(match.n.every((value,i)=>Math.abs(value-v.n[i])<1e-5));
      for(const time of [0,.4,2.7,3600])assert.ok(Math.abs(waterWave(s,v.lateral,v.bank,time)-waterWave(s,match.lateral,match.bank,time))<1e-7);
    }
    assert.ok(bankDistanceAt(s,0,'left')>4,'the virtual island tip cannot suppress waves in midstream');
  }
});

test('gravity owns flight, entry emits once, and racers float out without teleportation',()=>{
  const ducks=createDucks(42),events=[],flightSamples=new Map(),landings=[];
  const dt=1/120;
  for(let tick=1;tick<=120*20;tick++){
    const before=ducks.map(d=>({...d})),time=tick*dt;events.push(...step(ducks,time,dt));
    for(const d of ducks){
      const prev=before[d.id];
      assert.ok(d.s-prev.s<.15,'no forward rescue/landing teleport');
      if(prev.airborne&&d.airborne){
        assert.ok(Math.abs(d.verticalSpeed-prev.verticalSpeed+HEADWATER.gravity*dt)<1e-10);
        assert.ok(Math.abs(d.elevation-prev.elevation-(prev.verticalSpeed*dt-.5*HEADWATER.gravity*dt*dt))<1e-10);
        assert.ok(d.elevation>sampleChannel(d.s,'main').y,'airborne body clears the lower pool');
        flightSamples.set(d.id,(flightSamples.get(d.id)??0)+1);
      }
      if(prev.airborne&&!d.airborne){
        assert.ok(d.entrySpeed>12&&d.entrySpeed<15);assert.ok(Math.abs(d.elevation-sampleChannel(d.s,'main').y-.035)<1e-8);
        assert.ok(landingOffset(d,time+.12)<-.05,'entry creates visible immersion');landings.push(d.id);
      }
    }
  }
  assert.equal(landings.length,5);assert.equal(new Set(landings).size,5);
  for(const d of ducks){assert.ok(flightSamples.get(d.id)>120);assert.ok(!d.airborne);assert.equal(landingOffset(d,20),0);}
  for(const type of ['takeoff','splash'])assert.equal(events.filter(e=>e.type===type).length,5);
});

test('pause freezes airborne racers and reset clears flight, entry and landing state',()=>{
  const race=new RaceController(42);race.start(42);
  for(let i=0;i<2000&&!race.ducks.some(d=>d.airborne);i++)race.advance(1/60);
  assert.ok(race.ducks.some(d=>d.airborne));race.togglePause();
  const frozen=structuredClone(race.ducks);for(let i=0;i<20;i++)race.advance(.1);assert.deepEqual(race.ducks,frozen);
  race.reset(42);assert.ok(race.ducks.every(d=>!d.airborne&&d.landedAt===undefined&&d.elevation===undefined));
});

test('a free sheet spans the upper lip and reaches the lower pool; quarks effects freeze and clean up', t=>{
  const scene=new THREE.Scene(),sentinel=new THREE.Object3D();scene.add(sentinel);
  const fall=createHeadwaterFall(scene);t.after(()=>fall.dispose());
  const root=scene.getObjectByName('headwater-waterfall'),sheet=root.getObjectByName('free-falling-water-sheet');
  const p=sheet.geometry.attributes.position,uv=sheet.geometry.attributes.uv;
  let min=Infinity,max=-Infinity;
  for(let i=0;i<p.count;i++){
    assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));
    if(uv.getY(i)===0)assert.ok(Math.abs(p.getY(i)-sampleCourse(HEADWATER.lip).y-.035)<1e-4);
    if(uv.getY(i)===1)assert.ok(Math.abs(p.getY(i)-sampleCourse(HEADWATER.impact).y-.035)<1e-4);
    min=Math.min(min,p.getY(i));max=Math.max(max,p.getY(i));
  }
  assert.ok(max-min>9);
  fall.update(createDucks(42),0,1,.016,false);
  const batch=root.getObjectByName('quarks-waterfall-spray'),systems=[...batch.systemToBatchIndex.keys()];
  assert.ok(systems.some(s=>s.particleNum>0),'real quarks systems emit droplets');
  const snapshot=()=>systems.map(s=>s.particles.slice(0,s.particleNum).map(p=>[p.position.x,p.position.y,p.position.z,p.age]));
  const frozen=snapshot();fall.update(createDucks(42),0,1,.1,true);assert.deepEqual(snapshot(),frozen);
  fall.dispose();fall.dispose();assert.deepEqual(scene.children,[sentinel]);
});
