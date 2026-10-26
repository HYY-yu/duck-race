import type {PageLanguage} from './i18n-routing';
import type {EventReporter} from './observability';
import type {TrackChoice} from './track-navigation';
type Properties={language:PageLanguage;course:TrackChoice;entryCount:number};

/** Page-memory only. A replay is counted on actual start, not on its reset button. */
export function createGrowthActions(report:EventReporter){
 let generation=0,pendingReplay=false,copying=false,copied=false;
 return {
  reset(replay=false){generation++;pendingReplay=replay;copying=false;copied=false;},
  started(properties:Properties){
   generation++;copying=false;copied=false;
   const replay=pendingReplay;pendingReplay=false;
   if(replay)report('race_replayed',properties);
  },
  async copy(properties:Properties,write:()=>Promise<void>){
   if(copying)return false;
   copying=true;const round=generation;
   try{
    await write();
    if(round!==generation)return false;
    if(!copied){copied=true;report('results_copied',properties);}
    return true;
   }finally{if(round===generation)copying=false;}
  },
 };
}
