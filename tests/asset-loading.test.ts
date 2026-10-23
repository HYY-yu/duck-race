import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {GeneratedAssets,type ModelId} from '../src/generated-assets';
import {loadSceneAssets,sceneAssetPlan} from '../src/asset-loading';

function fixture(){const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));return {scene} as GLTF;}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}

test('subset loading coalesces in-flight requests and reuses decoded models',async()=>{
 const gate=deferred<GLTF>(),calls:ModelId[]=[];
 const assets=new GeneratedAssets(async id=>{calls.push(id);return gate.promise;});
 const first=assets.load(['duck','duck']),second=assets.load(['duck']);
 await Promise.resolve();assert.deepEqual(calls,['duck']);assert.equal(assets.has('duck'),false);
 gate.resolve(fixture());await Promise.all([first,second]);await assets.load(['duck']);
 assert.deepEqual(calls,['duck']);assert.deepEqual(assets.diagnostics.loaded,['duck']);assert.deepEqual(assets.diagnostics.requested,['duck']);
});

test('a library batch limits downloads to two at a time',async()=>{
 let active=0,maximum=0;const calls:ModelId[]=[];
 const assets=new GeneratedAssets(async id=>{calls.push(id);active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setImmediate(resolve));active--;return fixture();});
 await assets.load(['duck','bird','rabbit','tree-pine','tree-broadleaf']);
 assert.equal(maximum,2);assert.equal(calls.length,5);assert.equal(assets.diagnostics.loaded.length,5);
});

test('scene plans exclude unused scenery and the procedural scarf GLB',()=>{
 const plan=sceneAssetPlan({treeKinds:['tree-pine','tree-pine'],birds:false,rabbits:false,audience:false});
 assert.deepEqual(plan[0],{stage:'core',ids:['duck']});assert.deepEqual(plan[1].ids,['tree-pine']);assert.deepEqual(plan[3].ids,[]);
 assert.equal(plan.flatMap(p=>p.ids).includes('scarf'),false);
});

test('the duck attaches before optional requests, failures retain fallbacks and allow retry',async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
 const events:string[]=[],attempts=new Map<ModelId,number>();let active=0,maximum=0;
 const assets=new GeneratedAssets(async id=>{
  events.push(`request:${id}`);const attempt=(attempts.get(id)??0)+1;attempts.set(id,attempt);
  active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setImmediate(resolve));active--;
  if(id==='tree-pine'&&attempt===1)throw new Error('fixture network failure');return fixture();
 });
 await loadSceneAssets(assets,{treeKinds:['tree-pine','tree-broadleaf'],birds:true,rabbits:true,audience:true},id=>{events.push(`attach:${id}`);if(id==='bird')throw new Error('fixture attachment failure');},stage=>{events.push(`stage:${stage}`);},async()=>{events.push('yield');});
 assert.equal(maximum,2);assert.ok(events.indexOf('attach:duck')<events.indexOf('request:tree-pine'));
 assert.ok(events.indexOf('attach:tree-broadleaf')<events.indexOf('request:bird'));
 assert.equal(events.includes('attach:tree-pine'),false);assert.equal(events.includes('attach:audience-fox'),true);
 assert.equal(events.includes('request:scarf'),false);assert.deepEqual(assets.diagnostics.failed,['tree-pine']);
 assert.deepEqual(assets.diagnostics.attachmentFailed,['bird']);
 assert.deepEqual(events.filter(e=>e.startsWith('stage:')),['stage:core','stage:trees','stage:cosmetics','stage:wildlife']);
 await assets.load(['tree-pine']);assert.equal(assets.has('tree-pine'),true);assert.deepEqual(assets.diagnostics.failed,[]);
 assert.equal(attempts.get('tree-pine'),2);assert.ok(assets.diagnostics.milliseconds>=0);
});
