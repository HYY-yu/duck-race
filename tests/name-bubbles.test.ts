import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutNameBubbles} from '../src/duck-name-bubbles';

test('twelve nearby duck names remain distinct with stable identity and head columns',()=>{
 const anchors=Array.from({length:12},(_,id)=>({id,x:200+(id%3)*15,y:450+id%2,width:130})),before=JSON.stringify(anchors);
 const labels=layoutNameBubbles(anchors,600);
 assert.equal(JSON.stringify(anchors),before);assert.deepEqual(layoutNameBubbles([...anchors].reverse(),600),labels);
 assert.deepEqual([...labels.map(l=>l.id)].sort((a,b)=>a-b),anchors.map(l=>l.id));
 for(const [i,a]of labels.entries()){
  assert.equal(a.x,anchors[a.id].x);assert.ok(a.y<=anchors[a.id].y);
  for(const b of labels.slice(i+1))assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2+5||Math.abs(a.y-b.y)>=27);
 }
});

test('separated names keep their anchors and edge labels stay inside the scene',()=>{
 const anchors=[{id:0,x:50,y:60,width:50},{id:1,x:300,y:80,width:50}];assert.deepEqual(layoutNameBubbles(anchors,300),anchors);
 for(const label of layoutNameBubbles([{id:0,x:50,y:-20,width:50},{id:1,x:300,y:400,width:50}],300))assert.ok(label.y>=28&&label.y<=292);
});
