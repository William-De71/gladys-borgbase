import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  readToken,
  readLanguage,
  POLL_INTERVAL,
  STALE_HOURS,
} from '../src/config.js';

test('defaults: no token, 26 h, 900 s, automatic language', () => {
  assert.deepEqual(normalizeConfig(), {
    token: '',
    staleHours: STALE_HOURS.default,
    pollInterval: POLL_INTERVAL.default,
    language: 'auto',
  });
  assert.equal(normalizeConfig(null).token, '');
});

test('numbers are bounded, strings from the form accepted, garbage gives the default', () => {
  const config = normalizeConfig({ stale_hours: '48', poll_interval: '60', language: 'de' });
  assert.equal(config.staleHours, 48);
  assert.equal(config.pollInterval, POLL_INTERVAL.min);
  assert.equal(config.language, 'de');
  assert.equal(normalizeConfig({ stale_hours: 99999 }).staleHours, STALE_HOURS.max);
  assert.equal(normalizeConfig({ stale_hours: '' }).staleHours, STALE_HOURS.default);
  assert.equal(normalizeConfig({ poll_interval: 'abc' }).pollInterval, POLL_INTERVAL.default);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'auto');
});

test('a pasted token loses spaces, new lines and a "Bearer " prefix', () => {
  assert.equal(readToken('  Bearer eyJhb.cd\n.ef  '), 'eyJhb.cd.ef');
  assert.equal(readToken(42), '');
});

test('the stored language of the last widget request', () => {
  assert.equal(readLanguage({ last_language: 'fr' }, 'en'), 'fr');
  assert.equal(readLanguage({ last_language: 'french' }, 'en'), 'en');
  assert.equal(readLanguage(undefined, 'es'), 'es');
});
