import type {PageLanguage} from './i18n-routing';
export type DuckRushEvent =
  | 'page_view'
  | 'language_switch'
  | 'game_load_started'
  | 'game_ready'
  | 'race_started'
  | 'race_finished'
  | 'race_replayed'
  | 'results_copied'
  | 'asset_load_finished'
  | 'asset_stage_finished'
  | 'asset_failed'
  | 'web_vital';

type EventValue = string | number | boolean;
export type EventProperties = Readonly<Record<string, EventValue>>;
export type EventReporter = (event: DuckRushEvent, properties: EventProperties) => void;
const reporters = new Set<EventReporter>();

export function addEventReporter(reporter: EventReporter) {
  reporters.add(reporter);
  return () => { reporters.delete(reporter); };
}

declare global {
  interface Window {
    duckRushTelemetry?: {track(event: DuckRushEvent, properties: EventProperties): void};
    __DUCK_RUSH_WEB_VITALS__?: Readonly<{fcpMs?: number;lcpMs?: number;cls: number;maxInteractionMs?: number}>;
  }
}

/**
 * Privacy boundary for analytics adapters. Callers must send aggregate state only:
 * never participant names, copied results, speech transcripts, or unfiltered URLs/queries.
 */
export function trackEvent(event: DuckRushEvent, properties: EventProperties = {}) {
  console.info('[telemetry]', event, properties);
  for (const report of reporters) {
    try { report(event, properties); }
    catch (error) { console.warn('[telemetry] reporter failed', {event, errorType: error instanceof Error ? error.name : 'unknown'}); }
  }
  try {
    window.duckRushTelemetry?.track(event, properties);
  } catch (error) {
    console.warn('[telemetry] adapter failed', {event, errorType: error instanceof Error ? error.name : 'unknown'});
  }
}

export function observeWebVitals(language: PageLanguage) {
  if (!('PerformanceObserver' in window)) {
    console.debug('[performance] PerformanceObserver unavailable');
    return;
  }
  const metrics:{fcpMs?:number;lcpMs?:number;cls:number;maxInteractionMs?:number}={cls:0};
  Object.defineProperty(window,'__DUCK_RUSH_WEB_VITALS__',{configurable:true,get:()=>({...metrics})});
  try {
    const paint = new PerformanceObserver(list => {
      const fcp=list.getEntries().find(entry=>entry.name==='first-contentful-paint');
      if(fcp&&!metrics.fcpMs){metrics.fcpMs=Math.round(fcp.startTime);trackEvent('web_vital',{language,metric:'FCP',value:metrics.fcpMs});}
    });
    paint.observe({type:'paint',buffered:true});
  } catch (error) {
    console.debug('[performance] paint observer unavailable', {errorType: error instanceof Error ? error.name : 'unknown'});
  }
  try {
    const lcp = new PerformanceObserver(list => {
      const entry = list.getEntries().at(-1);
      if (entry){metrics.lcpMs=Math.round(entry.startTime);trackEvent('web_vital', {language, metric: 'LCP', value: metrics.lcpMs});}
    });
    lcp.observe({type: 'largest-contentful-paint', buffered: true});
  } catch (error) {
    console.debug('[performance] LCP observer unavailable', {errorType: error instanceof Error ? error.name : 'unknown'});
  }
  try {
    const shifts = new PerformanceObserver(list => {
      for (const entry of list.getEntries() as (PerformanceEntry & {value: number; hadRecentInput: boolean})[]) {
        if (!entry.hadRecentInput) metrics.cls += entry.value;
      }
    });
    shifts.observe({type: 'layout-shift', buffered: true});
  } catch (error) {
    console.debug('[performance] CLS observer unavailable', {errorType: error instanceof Error ? error.name : 'unknown'});
  }
  try {
    const interactions=new PerformanceObserver(list=>{
      for(const entry of list.getEntries())metrics.maxInteractionMs=Math.max(metrics.maxInteractionMs??0,Math.round(entry.duration));
    });
    interactions.observe({type:'event',buffered:true,durationThreshold:40} as PerformanceObserverInit);
  } catch(error){
    console.debug('[performance] interaction observer unavailable',{errorType:error instanceof Error?error.name:'unknown'});
  }
  addEventListener('pagehide',()=>{
    trackEvent('web_vital',{language,metric:'CLS',value:Number(metrics.cls.toFixed(4))});
    if(metrics.maxInteractionMs!==undefined)trackEvent('web_vital',{language,metric:'interaction-max',value:metrics.maxInteractionMs});
  },{once:true});
}
