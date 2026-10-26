/** Development checkpoints are one-shot entry actions, never refresh-persistent state.
 * Preserve course/seed, campaign attribution, language path and fragment values. */
export function inspectionEntry(href:string){
 const url=new URL(href),inspection=url.searchParams.get('inspect');
 if(inspection===null)return null;
 url.searchParams.delete('inspect');
 return {inspection,url:`${url.pathname}${url.search}${url.hash}`};
}
