import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ImpactEffects} from '../src/impact-effects';
import {Race} from '../src/simulation';

test('paused particles reuse GPU buffers, while time and generation changes still refresh them',()=>{
 const scene=new THREE.Scene(),effects=new ImpactEffects(scene),race=new Race(2,42);
 const droplets=scene.getObjectByName('impact-water-and-hit-droplets') as THREE.InstancedMesh;
 effects.update(race);const initial=droplets.instanceMatrix.version;
 effects.update(race);assert.equal(droplets.instanceMatrix.version,initial);
 race.start();for(let i=0;i<190;i++)race.step(1/60);
 effects.update(race);assert.ok(droplets.instanceMatrix.version>initial);
 const advancing=droplets.instanceMatrix.version;race.pause();effects.update(race);
 assert.equal(droplets.instanceMatrix.version,advancing);
 race.reset(2,42);effects.update(race);assert.ok(droplets.instanceMatrix.version>advancing);
});

test('particle writes keep independent position, color, size and opacity slots',async()=>{
 const {ParticleField}=await import('../src/particles');const field=new ParticleField(2);
 field.set(0,1,2,3,.5,.7,[.2,.3,.4]);field.set(1,4,5,6,.8,.9);field.commit();
 const attributes=field.object.geometry.attributes;
 assert.deepEqual(Array.from(attributes.position.array),[1,2,3,4,5,6]);
 assert.ok(Math.abs(attributes.tint.getX(0)-.2)<1e-6);
 assert.ok(Math.abs(attributes.tint.getX(1)-.88)<1e-6);
 assert.ok(Math.abs(attributes.size.getX(0)-.5)<1e-6);
 assert.ok(Math.abs(attributes.alpha.getX(1)-.9)<1e-6);
});
