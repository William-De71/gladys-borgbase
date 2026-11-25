import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWatcher } from '../src/watcher.js';
import { createBorgBaseClient } from '../src/borgbase-api.js';
import {
  borgbaseApi,
  defaultState,
  rawRepository,
  silent,
  NOW,
  NAS_ID,
  TEST_TOKEN,
} from './helpers/fixtures.js';

const HOUR = 3600000;

/**
 * @description A watcher on a fake BorgBase account.
 * @returns {object} `{ watcher, rounds, errors, state, fetch }`.
 */
function setup() {
  const state = { ...defaultState(), time: NOW, fail: null };
  const fetch = borgbaseApi(() => state);
  const failing = async (...args) =>
    state.fail ? borgbaseApi(() => state, { fail: state.fail })(...args) : fetch(...args);
  const borgbase = createBorgBaseClient({
    getToken: () => TEST_TOKEN,
    getUserAgent: () => 'test',
    fetch: failing,
    now: () => state.time,
  });
  const rounds = [];
  const errors = [];
  const watcher = createWatcher({
    borgbase,
    isEnabled: () => true,
    getIntervalMs: () => 900000,
    getStaleHours: () => 26,
    onRound: (round) => rounds.push(round),
    onError: (err) => errors.push(err),
    now: () => state.time,
    logger: silent,
  });
  return { watcher, rounds, errors, state };
}

const events = (round) =>
  round.repositories.flatMap((entry) =>
    entry.events.map((e) => `${entry.repository.name}:${e.key}`),
  );

test('the first round is a baseline: nothing fires, even an overdue repository', async () => {
  const { watcher, rounds } = setup();
  await watcher.round();
  assert.deepEqual(events(rounds[0]), []);
  assert.equal(watcher.repositories().length, 3);
  assert.equal(watcher.account().overdueCount, 1);
});

test('the next rounds report the transitions', async () => {
  const { watcher, rounds, state } = setup();
  await watcher.round();
  state.time = NOW + 2 * HOUR;
  state.repositories[0] = rawRepository({ lastModified: NOW + HOUR, usageMb: 460000 });
  state.repositories[1] = {
    ...state.repositories[1],
    lastModified: new Date(NOW + HOUR).toISOString(),
  };
  state.account.diskUsage = 905000;
  await watcher.round();
  assert.deepEqual(events(rounds[1]).sort(), [
    'laptop:backup_received',
    'laptop:backup_resumed',
    'nas:backup_received',
    'nas:quota_level_reached',
  ]);
  assert.deepEqual(rounds[1].accountEvents, [{ key: 'quota_level_reached', level: 90 }]);
  // Time passes without a write: the never-written repository becomes overdue.
  state.time = NOW + 26 * HOUR;
  await watcher.round();
  assert.deepEqual(events(rounds[2]), ['photos:backup_overdue']);
});

test('a failed round reports the error and keeps the snapshots; 429 delays the next', async () => {
  const { watcher, errors, state } = setup();
  await watcher.round();
  state.fail = [429, {}, { 'Retry-After': '3600' }];
  assert.equal(await watcher.round(), null);
  assert.equal(errors[0].kind, 'rate_limit');
  assert.equal(watcher.repositories().length, 3);
  assert.ok(watcher.nextDelay() >= 3600000);
  state.fail = null;
  await watcher.round();
  assert.equal(watcher.nextDelay(), 900000);
});

test('fresh() reads again only when the last round is too old; reset() forgets', async () => {
  const { watcher, state } = setup();
  assert.equal(await watcher.fresh(60000), true);
  const first = watcher.fetchedAt();
  state.time = NOW + 30000;
  await watcher.fresh(60000);
  assert.equal(watcher.fetchedAt(), first);
  state.time = NOW + 120000;
  await watcher.fresh(60000);
  assert.equal(watcher.fetchedAt(), NOW + 120000);
  watcher.reset();
  assert.equal(watcher.fetchedAt(), null);
  assert.equal(watcher.account(), null);
  assert.ok(watcher.repositories().every((r) => r.id !== NAS_ID));
});
