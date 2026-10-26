import {localized, type PageLanguage} from './i18n-routing';
export type TrackChoice='long'|'mountain';

/** Retired standard links open Pinewood Valley; unknown links use Snowpeak Rapids. */
export function resolveTrack(value:string|null|undefined):TrackChoice{return value==='long'||value==='standard'?'long':'mountain';}

export function courseLabel(course:TrackChoice|'standard',lang:PageLanguage){
 if(course==='standard')return localized(lang,'标准赛道（已下线）','Standard course (retired)','Đường đua tiêu chuẩn (đã ngừng)');
 return course==='long'?(localized(lang,'松风山谷','Pinewood Valley','Thung lũng Thông')):(localized(lang,'雪岭激流','Snowpeak Rapids','Ghềnh Tuyết'));
}

export function trackSearch(search:string,track:TrackChoice){
 const params=new URLSearchParams(search);
 params.set('track',track);
 return `?${params.toString()}`;
}
