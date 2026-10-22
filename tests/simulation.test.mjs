import test from 'node:test';
import assert from 'node:assert/strict';
import {createDucks,step,applyWaterDrag,getStandings,RADIUS,FINISH,applySeparation,shareWater,REPULSION_RADIUS} from '../src/simulation.ts';
import {COUNT,COURSE_LENGTH,FINISH_S,START_S,OBSTACLES,BAR_RADIUS,flowAt,sampleCourse,obstaclePose,HEADWATER,FORKS,CASCADES,RIVER_REACHES,channelSpans,sampleChannel,sampleSurface,channelAt} from '../src/course.ts';

const DT=1/120;
function run(seed,inspect=false){
  const ducks=createDucks(seed),events=[],pairOrder=new Map();
  let leader=null,leadChanges=0,passes=0,minSeparation=Infinity,maxCloseDuration=0,openForkMinSpacing=Infinity;
  const closeTicks=new Map();
  for(let tick=1;tick<=120*180;tick++){
    events.push(...step(ducks,tick*DT,DT));
    if(tick===600)leader=getStandings(ducks)[0];
    const candidate=getStandings(ducks)[0];
    if(leader&&candidate.id!==leader.id&&candidate.s-leader.s>.55){leadChanges++;leader=candidate;}
    if(inspect)for(const d of ducks){
      assert.ok([d.s,d.lateral,d.vs,d.vl,d.heading,d.angularVelocity].every(Number.isFinite));
      assert.ok(Math.abs(d.heading)<=Math.PI+1e-10&&Math.abs(d.angularVelocity)<=1.8);
      assert.ok(d.s>=RADIUS&&d.s<=COURSE_LENGTH-RADIUS);
      const channel=sampleChannel(d.s,d.route??'main');
      assert.ok(d.lateral>=channel.min+RADIUS-1e-8&&d.lateral<=channel.max-RADIUS+1e-8);
      assert.equal(channelAt(d.s,d.lateral).route,d.route);
      for(const other of ducks){
        if(other.id<=d.id)continue;
        const key=d.id+':'+other.id,distance=Math.hypot(d.s-other.s,d.lateral-other.lateral);
        if(shareWater(d,other)){
          minSeparation=Math.min(minSeparation,distance);
          if(d.fork&&d.fork===other.fork&&d.route===other.route){
            const fork=FORKS.find(f=>f.id===d.fork),low=fork.start+(fork.end-fork.start)*.3,high=fork.end-(fork.end-fork.start)*.3;
            if(d.s>low&&d.s<high&&other.s>low&&other.s<high)openForkMinSpacing=Math.min(openForkMinSpacing,distance);
          }
          const close=distance<1.25?(closeTicks.get(key)??0)+1:0;closeTicks.set(key,close);maxCloseDuration=Math.max(maxCloseDuration,close*DT);
        }
        if(tick>600&&d.finish===null&&other.finish===null&&Math.abs(d.s-other.s)>.7){
          const order=Math.sign(d.s-other.s),before=pairOrder.get(key);
          if(before!==undefined&&before!==order)passes++;pairOrder.set(key,order);
        }
      }
    }
    if(ducks.every(d=>d.finish!==null))return {ducks,events,leadChanges,passes,minSeparation,maxCloseDuration,openForkMinSpacing};
  }
  return {ducks,events,leadChanges,passes,minSeparation,maxCloseDuration,openForkMinSpacing};
}

test('five ducks start at rest on a single start line with reproducible slot allocation',()=>{
  const ducks=createDucks(12);
  assert.equal(ducks.length,COUNT);assert.equal(COUNT,5);
  assert.deepEqual(ducks,createDucks(12));assert.notDeepEqual(ducks,createDucks(13));
  assert.ok(ducks.every(d=>d.s===START_S&&d.vs===0&&d.vl===0&&d.finish===null));
  assert.equal(new Set(ducks.map(d=>d.lateral)).size,5);
  for(let i=0;i<ducks.length;i++)for(let j=i+1;j<ducks.length;j++)assert.ok(Math.abs(ducks[i].lateral-ducks[j].lateral)>=RADIUS*2);
});

test('course continuously descends and exposes valid shared water geometry',()=>{
  let previous=sampleCourse(0);
  for(let s=.25;s<=COURSE_LENGTH;s+=.25){
    const f=sampleCourse(s);
    assert.ok(f.y<previous.y,`descending at ${s}`);
    assert.ok(f.width>RADIUS*4&&f.depth>0&&f.slope>0);
    assert.ok(Math.abs(Math.hypot(f.tx,f.tz)-1)<1e-8);
    assert.ok(Math.abs(f.tx*f.nx+f.tz*f.nz)<1e-8);
    assert.ok(Math.hypot(f.x-previous.x,f.z-previous.z)<.26);
    previous=f;
  }
  assert.equal(FINISH,FINISH_S);
  assert.ok(COURSE_LENGTH>=320&&COURSE_LENGTH<=380);
  const drop=sampleCourse(0).y-sampleCourse(COURSE_LENGTH).y;
  assert.ok(drop>55&&drop<70);
  const positions=Array.from({length:100},(_,i)=>sampleCourse(COURSE_LENGTH*i/99).x);
  assert.ok(Math.max(...positions)>30&&Math.min(...positions)< -30);
});

test('passive water drag cannot propel a stationary duck in still water',()=>{
  const d=createDucks(1)[0],initial={...d};
  applyWaterDrag(d,{forward:0,lateral:0},DT);
  assert.deepEqual(d,initial);
  d.vs=4;d.vl=-2;
  applyWaterDrag(d,{forward:0,lateral:0},1);
  assert.ok(d.vs>0&&d.vs<4);assert.ok(d.vl<0&&d.vl> -2);
  const a=createDucks(1)[0],b={...a,id:999};
  applyWaterDrag(a,{forward:3,lateral:.4},DT);applyWaterDrag(b,{forward:3,lateral:.4},DT);
  assert.equal(a.vs,b.vs);assert.equal(a.vl,b.vl);
});

test('deep narrow chute reduces cross section and increases the shared current',()=>{
  const broad=sampleCourse(15),chute=sampleCourse(188);
  assert.ok(chute.width<broad.width/3);assert.ok(chute.depth>broad.depth);
  assert.ok(chute.width*chute.depth<broad.width*broad.depth);
  assert.ok(chute.slope>broad.slope);
  assert.ok(flowAt(188,0,0).forward>flowAt(15,0,0).forward*2);
});

test('lowered bar blocks crossing while the same raised bar allows it',()=>{
  const obstacle=OBSTACLES.find(o=>o.id==='bar-1');
  const blocked={id:0,s:obstacle.s-.8,lateral:0,vs:4,vl:0,finish:null,contacts:0};
  const open={...blocked};let blockedContacts=0;
  assert.ok(obstaclePose(obstacle,3.5).height-BAR_RADIUS<1.05);
  assert.ok(obstaclePose(obstacle,1.1).height-BAR_RADIUS>1.05);
  for(let tick=1;tick<=60;tick++){
    blockedContacts+=step([blocked],3.5+tick*DT,DT).filter(e=>e.type==='contact').length;
    step([open],1.1+tick*DT,DT);
  }
  assert.ok(blocked.s<=obstacle.s-RADIUS-BAR_RADIUS+1e-8);
  assert.ok(blockedContacts>0);assert.ok(open.s>obstacle.s+.6);
});

test('pendulum contact changes momentum using its visible pose',()=>{
  const obstacle=OBSTACLES.find(o=>o.id==='pendulum-1');
  const time=(Math.PI*2-obstacle.phase)/.98;
  const d={id:0,s:obstacle.s-1,lateral:0,vs:3,vl:0,finish:null,contacts:0};
  const events=step([d],time,DT);
  assert.ok(events.some(e=>e.type==='contact'&&e.obstacle===obstacle.id));
  assert.ok(d.vs<0);assert.ok(d.s<obstacle.s-1);
});

test('twenty seeded races finish inside the banks with actual pendulum and bar contacts',()=>{
  for(let seed=1;seed<=20;seed++){
    const {ducks,events,leadChanges,passes,minSeparation,maxCloseDuration,openForkMinSpacing}=run(seed,true);
    assert.equal(ducks.filter(d=>d.finish!==null).length,5,`seed ${seed}`);
    assert.equal(events.filter(e=>e.type==='finish').length,5);
    assert.ok(events.some(e=>e.obstacle?.startsWith('pendulum')));
    assert.ok(events.some(e=>e.obstacle?.startsWith('bar')));
    assert.ok(ducks.every(d=>d.finish>60&&d.finish<180));
    assert.ok(Math.max(...ducks.map(d=>d.finish))-Math.min(...ducks.map(d=>d.finish))>.2);
    assert.ok(minSeparation>=RADIUS*2-.001);
    assert.ok(maxCloseDuration<7,'no prolonged clumps');
    assert.ok(leadChanges>=3,'clear lead changes with a 0.55 m margin');
    assert.ok(passes>=8,'multiple pairwise overtakes with a 0.7 m margin');
    assert.ok(openForkMinSpacing>1.45,'visible spacing in open branch reaches');
    for(const fork of FORKS){
      const splits=events.filter(e=>e.type==='split'&&e.obstacle===fork.id);
      const merges=events.filter(e=>e.type==='merge'&&e.obstacle===fork.id);
      assert.equal(splits.length,COUNT);assert.equal(merges.length,COUNT);
      assert.equal(new Set(splits.map(e=>e.id)).size,COUNT);
      assert.equal(new Set(merges.map(e=>e.id)).size,COUNT);
      assert.ok(splits.some(e=>e.route==='left')&&splits.some(e=>e.route==='right'));
      assert.notDeepEqual(splits.map(e=>e.id),merges.map(e=>e.id),'fork changes the order');
      for(const split of splits)assert.equal(merges.find(e=>e.id===split.id).route,split.route,'no crossing through the island');
    }
  }
});

test('finished ducks drift into the run-out pool without duplicate finish events',()=>{
  const d={id:0,s:FINISH-.01,lateral:0,vs:3,vl:0,finish:null,contacts:0};
  let finishes=0;
  for(let tick=1;tick<=120;tick++)finishes+=step([d],tick*DT,DT).filter(e=>e.type==='finish').length;
  assert.equal(finishes,1);assert.ok(d.finish>=0&&d.finish<DT);assert.ok(d.s>FINISH+1);
});

test('standings put finish times first and break exact ties consistently',()=>{
  const ducks=createDucks(5);ducks[0].finish=12;ducks[1].finish=11;ducks[2].s=90;ducks[3].s=91;ducks[4].s=91;
  assert.deepEqual(getStandings(ducks).map(d=>d.id),[1,0,3,4,2]);
  assert.deepEqual(ducks.map(d=>d.id),[0,1,2,3,4]);
});

test('fixed-step replay is repeatable in this JS runtime',()=>{assert.deepEqual(run(1234),run(1234));});
test('invalid integration inputs fail visibly',()=>{
  assert.throws(()=>step(createDucks(1),0,0),RangeError);
  assert.throws(()=>step(createDucks(1),0,.1),RangeError);
  assert.throws(()=>step(createDucks(1),NaN,DT),RangeError);
});


test('both islands split real navigable ribbons with continuously descending independent water levels',()=>{
  assert.equal(FORKS.length,2);assert.equal(RIVER_REACHES.filter(r=>r.route==='main').length,3);
  for(const fork of FORKS){
    const mid=(fork.start+fork.end)/2,spans=channelSpans(mid);
    assert.deepEqual(spans.map(s=>s.route),['left','right']);
    assert.ok(spans[1].min-spans[0].max>6);
    assert.ok(Math.abs(spans[0].y-spans[1].y)>2);
    for(const route of ['left','right']){
      assert.ok(Math.abs(sampleChannel(fork.start,route).y-sampleCourse(fork.start).y)<1e-8);
      assert.ok(Math.abs(sampleChannel(fork.end,route).y-sampleCourse(fork.end).y)<1e-8);
      let previous=sampleChannel(fork.start,route);
      for(let s=fork.start+.1;s<=fork.end;s+=.1){
        const span=sampleChannel(s,route);
        assert.ok(span.y<previous.y&&span.slope>0,'no adverse slope');
        assert.ok(span.max-span.min>RADIUS*4&&span.depth>0);
        const surface=sampleSurface(s,(span.min+span.max)/2);
        assert.equal(surface.y,span.y);assert.equal(surface.depth,span.depth);
        previous=span;
      }
    }
  }
  for(let s=1;s<COURSE_LENGTH-1;s+=.41){
    const active=RIVER_REACHES.filter(r=>s>r.start&&s<r.end);
    assert.equal(active.length,channelSpans(s).length,'no overlapping main water beneath an island');
  }
});

test('three distinct cascades provide marked drops and widen into buffer pools',()=>{
  assert.equal(CASCADES.length,3);
  for(const drop of CASCADES){
    assert.ok(sampleCourse(drop.start).y-sampleCourse(drop.end).y>=drop.drop);
    if(drop.id==='headwater-drop')assert.ok(sampleCourse(HEADWATER.lip+.55).slope>5,'free fall has a cliff behind the sheet');
    else assert.ok(sampleCourse((drop.start+drop.end)/2).slope>.6);
    assert.ok(sampleCourse(drop.end+7).width>sampleCourse(drop.end-7).width);
  }
});

test('short-range separation is smooth, symmetric, bounded and absent across land',()=>{
  const make=(s,lateral)=>({id:0,s,lateral,vs:0,vl:0,finish:null,contacts:0});
  const a=make(10,0),b={...make(11.2,0),id:1};
  applySeparation([a,b],DT);
  assert.ok(a.vs<0&&b.vs>0);assert.ok(Math.abs(a.vs+b.vs)<1e-12);assert.equal(a.vl+b.vl,0);
  assert.ok(Math.abs(a.vs)<.02);assert.equal(a.s,10);assert.equal(b.s,11.2);
  const farA=make(10,0),farB=make(10+REPULSION_RADIUS+.01,0);
  applySeparation([farA,farB],DT);assert.equal(farA.vs,0);assert.equal(farB.vs,0);
  const fork=FORKS[0],left=make(fork.start+.5,-.6),right=make(fork.start+.5,.6);
  assert.equal(shareWater(left,right),false);applySeparation([left,right],DT);
  assert.equal(left.vs,0);assert.equal(right.vs,0);assert.equal(left.vl,0);assert.equal(right.vl,0);
});
