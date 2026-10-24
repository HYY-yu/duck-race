import type {PostHogConfig, PostHog} from 'posthog-js';
import type {DuckRushEvent, EventProperties, EventReporter} from './observability';

const eventNames = new Set<DuckRushEvent>([
  'page_view', 'language_switch', 'game_load_started', 'game_ready', 'race_started',
  'race_finished', 'asset_load_finished', 'asset_stage_finished', 'asset_failed', 'web_vital',
]);
// Explicit allowlist also removes SDK URL, referrer, campaign and person properties.
const propertyNames = new Set([
  'language', 'course', 'from', 'to', 'reason', 'sinceNavigationMs', 'renderer',
  'entryCount', 'durationMs', 'manual', 'loaded', 'failed', 'attachmentFailed',
  'stage', 'requested', 'asset', 'phase', 'metric', 'value', 'app', 'environment',
  'token', 'distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version',
  '$process_person_profile', '$time', '$geoip_disable',
]);

export function postHogOptions(host: string): Partial<PostHogConfig> {
  return {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    capture_exceptions: false,
    capture_performance: false,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    person_profiles: 'never',
    persistence: 'memory',
    ip: false,
    respect_dnt: true,
    save_referrer: false,
    store_google: false,
    before_send: event => {
      if (!event || !eventNames.has(event.event as DuckRushEvent)) return null;
      event.properties = Object.fromEntries(Object.entries(event.properties).filter(([key, value]) =>
        propertyNames.has(key) && ['string', 'number', 'boolean'].includes(typeof value) &&
        (typeof value !== 'number' || Number.isFinite(value)),
      ));
      // Keep ingestion-side GeoIP enrichment off even when the service sees a request IP.
      event.properties.$geoip_disable = true;
      return event;
    },
    on_request_error: () => console.warn('[telemetry] PostHog request failed; SDK retry policy applies'),
  };
}

type Client = Pick<PostHog, 'init' | 'capture'>;
type Configuration = {key?: string; host?: string; production: boolean; enableInDevelopment?: boolean};

/** Start loading independently of the game, retaining early events in a bounded queue. */
export function createPostHogReporter(
  config: Configuration,
  load: () => Promise<Client> = async () => (await import('posthog-js')).default,
): EventReporter | null {
  if (!config.production && !config.enableInDevelopment) {
    console.debug('[telemetry] PostHog disabled in development');
    return null;
  }
  const key = config.key?.trim(), host = config.host?.trim();
  if (!key || !host) {
    console.info('[telemetry] PostHog disabled: project key or host missing');
    return null;
  }
  try {
    const url = new URL(host);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid host');
  } catch {
    console.warn('[telemetry] PostHog disabled: invalid HTTPS ingestion host');
    return null;
  }
  let client: Client | null = null, failed = false, overflowWarned = false;
  const queue: {event: DuckRushEvent; properties: EventProperties}[] = [];
  const send = (event: DuckRushEvent, properties: EventProperties) => {
    try {
      client!.capture(event, {...properties, app: 'duck_rush', environment: config.production ? 'production' : 'development'},
        // Web Vitals emitted on pagehide must leave before the document is discarded.
        event === 'web_vital' && ['CLS', 'interaction-max'].includes(String(properties.metric))
          ? {transport: 'sendBeacon', send_instantly: true} : undefined);
    } catch (error) {
      console.warn('[telemetry] PostHog capture failed', {event, errorType: error instanceof Error ? error.name : 'unknown'});
    }
  };
  void Promise.resolve().then(load).then(sdk => {
    sdk.init(key, postHogOptions(host));
    client = sdk;
    console.info('[telemetry] PostHog initialized', {environment: config.production ? 'production' : 'development'});
    for (const item of queue.splice(0)) send(item.event, item.properties);
  }).catch(error => {
    failed = true;
    queue.length = 0;
    console.warn('[telemetry] PostHog initialization failed', {errorType: error instanceof Error ? error.name : 'unknown'});
  });
  return (event, properties) => {
    if (failed) return;
    if (client) { send(event, properties); return; }
    if (queue.length < 100) queue.push({event, properties: {...properties}});
    else if (!overflowWarned) {
      overflowWarned = true;
      console.warn('[telemetry] PostHog startup queue full; additional events dropped');
    }
  };
}
