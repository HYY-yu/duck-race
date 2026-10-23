import {TRACK_LENGTH} from './track';
import type {Race} from './simulation';
export type AudienceAction='watch'|'wave'|'clap'|'hop'|'both';
export interface ViewerBehavior {
 target:number|null;action:AudienceAction;actionAt:number;until:number;nextLook:number;nextGesture:number;
 reactionAt:number;reactionDuck:number|null;rng:number;speed:number;
}
const reactions=[.18,.72,.38,1.05],speeds=[5.2,3.1,6.7,4.3];
/** Independent attention and gestures. Reads real race positions/finish times only;
 * there is no shared cheering oscillator or simulated "AI" affecting the race. */
export class AudienceDirector {
 readonly viewers:ViewerBehavior[]=Array.from({length:4},(_,i)=>({target:null,action:'watch',actionAt:0,until:0,nextLook:0,nextGesture:0,reactionAt:Infinity,reactionDuck:null,rng:i+1,speed:speeds[i]}));
 private generation=-1;private finishes=0;
 private random(v:ViewerBehavior){v.rng=(Math.imul(v.rng,1664525)+1013904223)>>>0;return v.rng/4294967296;}
 update(race:Race){
  const now=race.floatTime;
  if(this.generation!==race.generation){
   this.generation=race.generation;this.finishes=0;
   this.viewers.forEach((v,i)=>Object.assign(v,{target:null,action:'watch',actionAt:now,until:now,nextLook:now,nextGesture:now+1+i*.83,reactionAt:Infinity,reactionDuck:null,rng:(race.seed+Math.imul(i+1,2654435761))>>>0}));
  }
  if(race.results.length>this.finishes){
   this.finishes=race.results.length;const recent=race.results.at(-1)!;
   this.viewers.forEach((v,i)=>{v.reactionAt=recent.finish!+reactions[i];v.reactionDuck=recent.id;});
  }
  const approaching=race.ducks.filter(d=>d.finish===null&&d.s>TRACK_LENGTH-65).sort((a,b)=>b.s-a.s);
  const arrived=[...race.results].reverse();
  this.viewers.forEach((v,i)=>{
   if(now>=v.until)v.action='watch';
   if(now>=v.nextLook){
    const candidates=i===3&&arrived.length?arrived:approaching.length?approaching:arrived;
    v.target=candidates.length?candidates[Math.min(i===3?0:i,candidates.length-1)].id:null;
    v.nextLook=now+2.5+this.random(v)*2.8;
   }
   if(now>=v.reactionAt&&v.reactionDuck!==null){
    v.action=(['hop','clap','wave','both'] as const)[i];v.actionAt=v.reactionAt;v.until=v.actionAt+2.1+this.random(v)*1.3;
    if(i===0||i===3){v.target=v.reactionDuck;v.nextLook=v.until+.5;}
    v.reactionAt=Infinity;v.reactionDuck=null;v.nextGesture=v.until+1.4+this.random(v)*3;
   }else if(v.action==='watch'&&now>=v.nextGesture&&v.target!==null&&race.state==='racing'){
    v.action=i===1?'clap':i===3?'both':'wave';v.actionAt=now;v.until=now+1.2+this.random(v)*1.4;v.nextGesture=v.until+1.8+this.random(v)*4;
   }
  });
 }
}
