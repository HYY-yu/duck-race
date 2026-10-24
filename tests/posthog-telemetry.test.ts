import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PostHog} from 'posthog-js';
import {createPostHogReporter, postHogOptions} from '../src/posthog-telemetry';
import {addEventReporter, trackEvent} from '../src/observability';

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
  const {client, events} = fixture();
  const report = createPostHogReporter({...configuration, production: false, enableInDevelopment: true}, async () => client)!;
  report('page_view', {});
  await tick();
  assert.equal((events[0][1] as Record<string, string>).environment, 'development');
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
