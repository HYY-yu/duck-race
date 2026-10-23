export const RESULTS_DELAY=9;
export interface ArrivalState {state:string;generation:number;ducks:readonly {s:number}[];}
/** Visible viewing time, separate from the official race and post-race water clocks.
 * No timers survive reset; a help/history modal or a hidden tab suspends the delay. */
export class FinishPresentation {
 age=0;started=false;shown=false;private generation=-1;
 reset(generation:number){this.generation=generation;this.age=0;this.started=false;this.shown=false;}
 update(race:ArrivalState,dt:number,visible:boolean,lakeEntry:number){
  if(race.generation!==this.generation)this.reset(race.generation);
  if(race.state!=='finished')return {started:false,reveal:false};
  const started=!this.started;this.started=true;
  if(visible)this.age+=Math.max(0,dt);
  const reveal=visible&&!this.shown&&this.age>=RESULTS_DELAY&&race.ducks.every(d=>d.s>=lakeEntry);
  return {started,reveal};
 }
}
