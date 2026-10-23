export type TrackChoice='standard'|'long'|'mountain';

export function trackSearch(search:string,track:TrackChoice){
 const params=new URLSearchParams(search);
 params.set('track',track);
 return `?${params.toString()}`;
}
