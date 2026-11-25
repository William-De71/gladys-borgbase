// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices and the states like the host API does, and a fake BorgBase.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { SCENE_ACTIONS } from '../src/scene-actions.js';
import {
  borgbaseApi,
  defaultState,
  rawRepository,
  silent,
  NOW,
  NAS_ID,
  ACCOUNT_ID,
  TEST_TOKEN,
} from './helpers/fixtures.js';

const CONFIG = { token: TEST_TOKEN };
const NAS = `ext:test-integration:repo:${NAS_ID}`;
const ACCOUNT = `ext:test-integration:account:${ACCOUNT_ID}`;

/**
 * @description The integration, connected to a fake Gladys and a fake BorgBase.
 * @param {object} [options] - `{ config, meError }`.
 * @returns {Promise<object>} `{ gladys, app, state, fetch, clock }`.
 */
async function startApp({ config = CONFIG, meError = false } = {}) {
  const state = { ...defaultState(), meError };
  const fetch = borgbaseApi(() => state);
  const clock = { now: NOW };
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, { fetchImpl: fetch, now: () => clock.now, logger: silent });
  await gladys.connect();
  return { gladys, app, state, fetch, clock };
}

test('the account and every repository are offered, accepted by the host API checks', async (t) => {
  const { gladys, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(fetch.calls.length, 1, 'one query per round');
  const ids = gladys.fake.discoveredDevices.map((device) => device.external_id);
  assert.equal(ids[0], ACCOUNT);
  assert.ok(ids.includes(NAS));
  assert.equal(ids.length, 4);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(
    gladys.fake.connectionStatus.message.en,
    'Connected to BorgBase: 3 repositories, 1 overdue.',
  );
  assert.equal(gladys.fake.states.length, 0, 'nothing before a device exists');
});

test('creating a device publishes its states; later rounds fire the scene events', async (t) => {
  const { gladys, app, state, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.deviceCreated(
    gladys.fake.discoveredDevices.find((device) => device.external_id === NAS),
  );
  assert.equal(gladys.fake.lastState(`${NAS}:usage`), 412.35);
  assert.equal(gladys.fake.lastState(`${NAS}:quota_used`), 82.5);
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.OVERVIEW));
  clock.now = NOW + 3600000;
  state.repositories[0] = rawRepository({ lastModified: NOW + 1800000, usageMb: 455000 });
  await app.watcher.round();
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => event.key),
    ['backup_received', 'quota_level_reached'],
  );
  assert.equal(gladys.fake.sceneEvents[0].data.repository, NAS);
  assert.equal(gladys.fake.sceneEvents[1].data.level, '90');
  assert.equal(gladys.fake.lastState(`${NAS}:hours_since_backup`), 0.5);
});

test('widgets answer from the last round, valid in the core format', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const key of Object.values(WIDGETS)) {
    const ack = await gladys.fake.widgetGet(key, {
      settings: { repository: NAS },
      language: 'fr',
    });
    assert.equal(ack.success, true, key);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], key);
  }
  const usage = await gladys.fake.widgetGet(WIDGETS.USAGE, { settings: {}, language: 'en' });
  assert.equal(usage.data.content.components[0].text, 'Whole account');
});

test('no token: a clear status, widgets and actions say why, nothing is read', async (t) => {
  const { gladys, fetch } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  assert.equal(fetch.calls.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /API token/);
  const widget = await gladys.fake.widgetGet(WIDGETS.REPOSITORIES, {
    settings: {},
    language: 'es',
  });
  assert.match(widget.data.content.components[0].text, /token de API/);
  const tested = await gladys.fake.action('test_connection', {});
  assert.match(JSON.stringify(tested.data), /API token/);
  const action = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_ACCOUNT, {});
  assert.equal(action.success, false);
  assert.match(action.error, /not configured/);
});

test('a refused token gives the status that says what to fix', async (t) => {
  const { gladys } = await startApp({ config: { token: 'wrong' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /refuse le jeton/);
  const tested = await gladys.fake.action('test_connection', {});
  assert.match(JSON.stringify(tested.data), /refuses the API token/);
});

test('a token that cannot read the account: repositories only, and the status says so', async (t) => {
  const { gladys } = await startApp({ meError: true });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.discoveredDevices.length, 3);
  assert.match(gladys.fake.connectionStatus.message.en, /cannot read the account/);
  const usage = await gladys.fake.widgetGet(WIDGETS.USAGE, { settings: {}, language: 'en' });
  assert.equal(usage.data.content.components[0].text, 'nas', 'the largest repository');
});

test('scene actions read the snapshots and never fire a scene event', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const repository = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_REPOSITORY, {
    repository: NAS,
  });
  assert.equal(repository.data.outputs.repository_name, 'nas');
  const account = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_ACCOUNT, {});
  assert.equal(account.data.outputs.overdue_names, 'laptop');
  const tested = await gladys.fake.action('test_connection', {});
  assert.match(JSON.stringify(tested.data), /Token accepted: 3 repositories read, 1 with/);
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('a new threshold starts a new baseline: no event for a change the user made', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.configUpdated({ token: TEST_TOKEN, stale_hours: 1 });
  assert.equal(gladys.fake.sceneEvents.length, 0);
  assert.match(gladys.fake.connectionStatus.message.en, /3 overdue/);
});
