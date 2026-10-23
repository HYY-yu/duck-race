import type {GeneratedAssets,ModelId} from './generated-assets';
import {trackEvent} from './observability';

export type AssetStage='core'|'trees'|'cosmetics'|'wildlife';
export type SceneAssetUsage={treeKinds:readonly ('tree-broadleaf'|'tree-pine')[];birds:boolean;rabbits:boolean;audience:boolean};
export function sceneAssetPlan(usage:SceneAssetUsage):{stage:AssetStage;ids:ModelId[]}[]{
 return [
  {stage:'core',ids:['duck']},
  {stage:'trees',ids:[...new Set(usage.treeKinds)]},
  // Shared by all courses. The scarf is procedural and needs no GLB request.
  {stage:'cosmetics',ids:['pirate-hat','knight-helmet','glasses']},
  {stage:'wildlife',ids:[...(usage.birds?['bird' as const]:[]),...(usage.rabbits?['rabbit' as const]:[]),...(usage.audience?['audience-white-rabbit','audience-bear','audience-fox','audience-gray-rabbit'] as const:[])]},
 ];
}

/** Give rendering/input a turn between small batches; timeout prevents starvation.
 * Used only for optional visuals, so the first duck request never waits for idle. */
export function yieldForAssets():Promise<void>{
 return new Promise(resolve=>{
  if(window.requestIdleCallback)window.requestIdleCallback(()=>resolve(),{timeout:500});
  else setTimeout(resolve,32);
 });
}

export async function loadSceneAssets(assets:GeneratedAssets,usage:SceneAssetUsage,attach:(id:ModelId)=>void,onStage:(stage:AssetStage)=>void,yieldWork=yieldForAssets){
 const started=performance.now();
 for(const {stage,ids}of sceneAssetPlan(usage)){
  onStage(stage);const start=performance.now();
  for(let i=0;i<ids.length;i+=2){
   if(stage!=='core')await yieldWork();
   await Promise.all(ids.slice(i,i+2).map(async id=>{
    await assets.load([id]);
    // A failed model retains its procedural version without blocking other assets.
    if(assets.has(id)){
     if(stage!=='core')await yieldWork();
     try{attach(id);assets.diagnostics.attachmentFailed=assets.diagnostics.attachmentFailed.filter(failed=>failed!==id);}
     catch(error){
      if(!assets.diagnostics.attachmentFailed.includes(id))assets.diagnostics.attachmentFailed.push(id);
      console.error('[assets] model attachment failed',{id,error});trackEvent('asset_failed',{asset:id,phase:'attachment'});
     }
    }
   }));
  }
  const durationMs=Math.round(performance.now()-start);
  const failed=ids.filter(id=>!assets.has(id)||assets.diagnostics.attachmentFailed.includes(id)).length;
  console.info('[assets] stage finished',{stage,requested:ids.length,failed,durationMs});
  trackEvent('asset_stage_finished',{stage,requested:ids.length,failed,durationMs});
 }
 assets.diagnostics.milliseconds=performance.now()-started;
 trackEvent('asset_load_finished',{loaded:assets.diagnostics.loaded.length,failed:assets.diagnostics.failed.length,attachmentFailed:assets.diagnostics.attachmentFailed.length,durationMs:Math.round(assets.diagnostics.milliseconds)});
}
