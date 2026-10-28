import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SteeringInput,STEERING_KEYS} from '../src/youtube/input';
import {duckLabel,DUCK_COLORS} from '../src/youtube/copy';
import {Race} from '../src/simulation';

test('YouTube steering combines keyboard and multiple fingers without stuck directions',()=>{
 const input=new SteeringInput();
 input.press('pointer:1',-1);assert.equal(input.axis,-1);
 input.press('key:ArrowLeft',-1);input.release('pointer:1');assert.equal(input.axis,-1);
 input.press('pointer:2',1);assert.equal(input.axis,0);
 input.release('key:ArrowLeft');assert.equal(input.axis,1);
 input.release('pointer:2');assert.equal(input.axis,0);
 input.press('key:KeyA',-1);input.press('key:KeyA',-1);input.release('key:KeyA');assert.equal(input.axis,0);
 input.press('pointer:3',1);input.clear();assert.equal(input.axis,0);
 assert.equal(STEERING_KEYS.get('KeyD'),1);assert.equal(STEERING_KEYS.get('ArrowLeft'),-1);
});

test('YouTube ducks use distinct fixed color and number labels in both languages',()=>{
 for(const language of ['zh','en'] as const){
  const labels=DUCK_COLORS.map((_,id)=>duckLabel(id,language));
  assert.equal(new Set(labels).size,12);assert.match(labels[0],/^01 · /);assert.match(labels[11],/^12 · /);
 }
 assert.equal(new Set(DUCK_COLORS).size,12);
});

test('YouTube lateral input affects the selected duck and reset removes prior control',()=>{
 const automatic=new Race(12,42),controlled=new Race(12,42);
 automatic.start();controlled.start();
 for(let i=0;i<182;i++){automatic.step(1/60);controlled.step(1/60);}
 controlled.setSteering(4,1);
 for(let i=0;i<30;i++){automatic.step(1/60);controlled.step(1/60);}
 assert.equal(controlled.controlled,true);assert.equal(automatic.controlled,false);
 assert.ok(controlled.ducks[4].lane>automatic.ducks[4].lane);
 controlled.reset(12,42);assert.equal(controlled.steering.axis,0);assert.equal(controlled.controlled,false);
});
