/** Closed campaign vocabulary; no URL or arbitrary query value reaches analytics. */
export type CampaignAttribution = Readonly<Partial<Record<'utm_source'|'utm_medium'|'utm_campaign',string>>>;
export function campaignAttribution(search:string):CampaignAttribution {
 if(search.length>2048)return Object.freeze({});
 const params=new URLSearchParams(search);
 const keys=['utm_source','utm_medium','utm_campaign'] as const;
 if(keys.some(key=>params.getAll(key).length!==1))return Object.freeze({});
 const source=params.get('utm_source')!,medium=params.get('utm_medium')!,campaign=params.get('utm_campaign')!;
 if(source.length>8||medium.length>16||campaign.length>32)return Object.freeze({});
 if(!['x','tiktok'].includes(source)||medium!=='social'||campaign!=='duck_rush_launch_2026_10')return Object.freeze({});
 return Object.freeze({utm_source:source,utm_medium:medium,utm_campaign:campaign});
}
