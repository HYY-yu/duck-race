export type TrackChoice='long'|'mountain';

/** Retired standard links open Pinewood Valley; unknown links use Snowpeak Rapids. */
export function resolveTrack(value:string|null|undefined):TrackChoice{return value==='long'||value==='standard'?'long':'mountain';}

export function courseLabel(course:TrackChoice|'standard',lang:'zh'|'en'){
 if(course==='standard')return lang==='zh'?'标准赛道（已下线）':'Standard course (retired)';
 return course==='long'?(lang==='zh'?'松风山谷':'Pinewood Valley'):(lang==='zh'?'雪岭激流':'Snowpeak Rapids');
}

export function trackSearch(search:string,track:TrackChoice){
 const params=new URLSearchParams(search);
 params.set('track',track);
 return `?${params.toString()}`;
}
