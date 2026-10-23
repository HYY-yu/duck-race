import type {Race} from './simulation';
export interface RaceNotice {kind:'contact'|'landing'|'pass';duck:number;other?:number;born:number;until:number;}
/** Observe contacts and confirmed position crossings; never change racing state. */
export class RaceFeedback {
 notices:RaceNotice[]=[];readonly hits=Array<number>(12).fill(-99);
 private generation=-1;private seq=0;private leaders=new Map<string,number>();private lastNotice=-99;
 update(race:Race){
  const now=race.floatTime;
  if(this.generation!==race.generation){this.generation=race.generation;this.seq=0;this.notices=[];this.hits.fill(-99);this.leaders.clear();this.lastNotice=-99;}
  this.notices=this.notices.filter(n=>n.until>now);
  for(const event of race.events){
   if(event.seq<=this.seq)continue;this.seq=event.seq;
   if(race.time-event.time>.15)continue;
   if(event.kind==='contact'&&event.strength>1.5){this.hits[event.duck]=now;this.notice('contact',event.duck,now);}
   else if(event.kind==='landing'&&event.strength>5)this.notice('landing',event.duck,now);
  }
  for(let i=0;i<race.ducks.length;i++)for(let j=i+1;j<race.ducks.length;j++){
   const a=race.ducks[i],b=race.ducks[j],key=`${a.id}:${b.id}`,gap=a.s-b.s;
   if(a.finish!==null||b.finish!==null||Math.abs(gap)<.8)continue;
   const leader=gap>0?a.id:b.id,previous=this.leaders.get(key);this.leaders.set(key,leader);
   if(previous!==undefined&&previous!==leader&&race.state==='racing'&&race.time>5)this.notice('pass',leader,now,previous);
  }
 }
 private notice(kind:RaceNotice['kind'],duck:number,now:number,other?:number){
  if(now-this.lastNotice<.9)return;
  this.notices=[...this.notices.slice(-1),{kind,duck,other,born:now,until:now+2.5}];this.lastNotice=now;
  console.debug('[feedback]',kind,{duck,other});
 }
}
