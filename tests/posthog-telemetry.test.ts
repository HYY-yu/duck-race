import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import type {PostHog} from 'posthog-js';
import {createServer} from 'node:http';
import {createPostHogReporter, postHogOptions} from '../src/posthog-telemetry';
import {addEventReporter, trackEvent} from '../src/observability';
import {createGrowthActions} from '../src/growth-actions';

let originalWindow: PropertyDescriptor | undefined;
function browserLocation(href: string) {
  Object.defineProperty(globalThis, 'window', {configurable: true, value: {location: new URL(href)}});
}
beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  browserLocation('https://duckracepicker.com/en/');
});
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

const tick = () => new Promise(resolve => setImmediate(resolve));
const configuration = {key: 'phc_test', host: 'https://example.com', production: true};
function fixture() {
  const events: unknown[][] = [], initializations: unknown[][] = [];
  const client = {
    init: (...args: unknown[]) => {initializations.push(args);},
    capture: (...args: unknown[]) => {events.push(args);},
  } as unknown as Pick<PostHog, 'init' | 'capture'>;
  return {client, events, initializations};
}

test('disabled or incomplete configurations never load the SDK', async () => {
  let loads = 0;
  const load = async () => {loads++; return fixture().client;};
  for (const config of [
    {...configuration, production: false}, {...configuration, key: ''},
    {...configuration, host: ''}, {...configuration, host: 'http://example.com'},
    {...configuration, host: 'https://user:password@example.com'},
  ]) assert.equal(createPostHogReporter(config, load), null);
  await tick();
  assert.equal(loads, 0);
});

test('early events arrive in order and later events capture immediately, with unload transport', async () => {
  const {client, events, initializations} = fixture();
  const report = createPostHogReporter(configuration, async () => client)!;
  report('page_view', {language: 'zh', course: 'long'});
  report('game_load_started', {reason: 'viewport'});
  assert.equal(events.length, 0);
  await tick();
  assert.equal(initializations.length, 1);
  assert.deepEqual(events.map(e => e[0]), ['page_view', 'game_load_started']);
  assert.deepEqual(events[0][1], {language: 'zh', course: 'long', app: 'duck_rush', environment: 'production'});
  report('web_vital', {metric: 'CLS', value: 0.1});
  assert.deepEqual(events[2][2], {transport: 'sendBeacon', send_instantly: true});
});

test('development requires explicit opt-in and marks its events', async () => {
  browserLocation('http://localhost:5183/en/');
  const {client, events} = fixture();
  const report = createPostHogReporter({...configuration, production: false, enableInDevelopment: true}, async () => client)!;
  report('page_view', {});
  await tick();
  assert.equal((events[0][1] as Record<string, string>).environment, 'development');
});

test('production is denied outside the exact browser origin, including SSR and spoofed hints', async () => {
  let loads = 0;
  const load = async () => { loads++; return fixture().client; };
  for (const href of [
    'http://localhost:5184/en/', 'http://127.0.0.1:5184/en/', 'http://[::1]:5184/en/',
    'http://192.168.1.2:5184/en/', 'file:///tmp/en/index.html',
    'https://duckracepicker.workers.dev/en/', 'https://duckracepicker.pages.dev/en/',
    'https://www.duckracepicker.com/en/', 'https://preview.duckracepicker.com/en/',
    'https://duckracepicker.com.evil.example/en/', 'https://evilduckracepicker.com/en/',
    'https://duckracepicker.com@evil.example/en/', 'https://duckracepicker.com:444/en/',
    'http://duckracepicker.com/en/', 'https://duckracepicker.com./en/',
    'http://localhost/?origin=https://duckracepicker.com&environment=production',
  ]) {
    browserLocation(href);
    assert.equal(createPostHogReporter({...configuration, enableInDevelopment: true}, load), null, href);
  }
  Reflect.deleteProperty(globalThis, 'window');
  assert.equal(createPostHogReporter(configuration, load), null, 'SSR');
  Object.defineProperty(globalThis, 'window', {configurable: true, value: {}});
  assert.equal(createPostHogReporter(configuration, load), null, 'missing location');
  await tick();
  assert.equal(loads, 0);
});

test('origin is checked again before async initialization, capture and SDK payload delivery', async () => {
  const {client, events, initializations} = fixture();
  let resolve!: (sdk: Pick<PostHog, 'init' | 'capture'>) => void;
  const report = createPostHogReporter(configuration, () => new Promise(done => { resolve = done; }))!;
  report('page_view', {});
  await tick();
  browserLocation('http://localhost:5184/');
  resolve(client);
  await tick();
  assert.equal(initializations.length, 0);
  assert.equal(events.length, 0);

  browserLocation('https://duckracepicker.com/en/');
  const config = {...configuration};
  const initialized = createPostHogReporter(config, async () => client)!;
  await tick();
  const options = initializations[0][1] as ReturnType<typeof postHogOptions>;
  const filter = options.before_send as (payload: unknown) => unknown;
  browserLocation('http://localhost:5184/');
  config.production = false;
  initialized('race_started', {environment: 'production', entryCount: 2});
  assert.equal(events.length, 0, 'mutating config or event fields cannot bypass the captured build mode');
  assert.equal(filter({event: 'race_started', properties: {environment: 'production'}}), null);
});

test('formal HTTPS origin preserves page/start/finish/replay/copy through the filtered mock collector', async () => {
  browserLocation('https://duckracepicker.com:443/en/?utm_source=x');
  const collected: {event: string; properties: Record<string, unknown>}[] = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    collected.push(JSON.parse(body));
    response.writeHead(204).end();
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const pending: Promise<void>[] = [];
  let options!: ReturnType<typeof postHogOptions>;
  const client = {
    init: (_key: string, config: typeof options) => { options = config; },
    capture: (event: string, properties: Record<string, unknown>) => {
      const filter = options.before_send as (payload: unknown) => typeof collected[number] | null;
      const payload = filter({event, properties});
      if (payload) pending.push(fetch(`http://127.0.0.1:${address.port}/capture`, {
        method: 'POST', body: JSON.stringify(payload), signal: AbortSignal.timeout(3000),
      }).then(response => { assert.equal(response.status, 204); }));
    },
  } as unknown as Pick<PostHog, 'init' | 'capture'>;
  const report = createPostHogReporter(configuration, async () => client)!;
  const remove = addEventReporter(report);
  const props = {language: 'en' as const, course: 'mountain' as const, entryCount: 2};
  try {
    trackEvent('page_view', {language: 'en', course: 'mountain', environment: 'development', names: 'discard'});
    await tick();
    trackEvent('race_started', props);
    trackEvent('race_finished', {...props, durationMs: 30000, manual: false});
    const actions = createGrowthActions(trackEvent);
    actions.reset(true);
    actions.started(props);
    await actions.copy(props, async () => {});
    await Promise.all(pending);
    assert.deepEqual(collected.map(e => e.event), ['page_view', 'race_started', 'race_finished', 'race_replayed', 'results_copied']);
    for (const payload of collected) {
      assert.equal(payload.properties.app, 'duck_rush');
      assert.equal(payload.properties.environment, 'production');
      assert.equal(payload.properties.$geoip_disable, true);
      assert.equal(payload.properties.names, undefined);
    }
    assert.equal(collected[2].properties.durationMs, 30000);
    assert.equal(collected[2].properties.manual, false);
  } finally {
    remove();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('SDK payload filtering drops automatic events, names, URL queries, referrers and nested profiles', () => {
  const options = postHogOptions(configuration.host);
  assert.equal(options.autocapture, false);
  assert.equal(options.capture_pageview, false);
  assert.equal(options.capture_pageleave, false);
  assert.equal(options.disable_session_recording, true);
  assert.equal(options.persistence, 'memory');
  assert.equal(options.person_profiles, 'never');
  assert.equal(options.ip, false);
  const filter = options.before_send as (event: unknown) => {properties: Record<string, unknown>} | null;
  assert.equal(filter({event: '$autocapture', properties: {}}), null);
  const result = filter({event: 'race_started', properties: {
    entryCount: 5, distinct_id: 'anonymous-id', token: 'phc_test',
    '$current_url': 'https://example.com/?name=secret', '$referrer': 'https://example.com/private',
    '$set_once': {email: 'private@example.com'}, names: 'secret', transcript: 'private',
    durationMs: NaN,
  }});
  assert.deepEqual(result?.properties, {entryCount: 5, distinct_id: 'anonymous-id', token: 'phc_test', $geoip_disable: true});
});

test('load failure never rejects into gameplay and startup queue stays bounded', async () => {
  const report = createPostHogReporter(configuration, async () => {throw new Error('offline');})!;
  report('page_view', {});
  await tick();
  assert.doesNotThrow(() => report('race_started', {entryCount: 4}));
  const {client, events} = fixture();
  const buffered = createPostHogReporter(configuration, async () => client)!;
  for (let i = 0; i < 110; i++) buffered('web_vital', {value: i});
  await tick();
  assert.equal(events.length, 100);
});

test('one failing reporter does not suppress PostHog or the existing window adapter', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const received: string[] = [];
  Object.defineProperty(globalThis, 'window', {configurable: true, value: {duckRushTelemetry: {track: () => received.push('external')}}});
  const removeFailure = addEventReporter(() => {throw new Error('broken adapter');});
  const removeHealthy = addEventReporter(() => received.push('posthog'));
  try {
    trackEvent('race_started', {entryCount: 2});
    assert.deepEqual(received, ['posthog', 'external']);
  } finally {
    removeFailure(); removeHealthy();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
