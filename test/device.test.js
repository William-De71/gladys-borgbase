// The discovered devices and their states, checked against the SDK constants
// and the host API rules (section 2 bis of the integration guide).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';

import {
  buildRepositoryDevice,
  buildAccountDevice,
  buildRepositoryStates,
  buildAccountStates,
  parseExternalId,
} from '../src/device.js';
import { readRound } from '../src/read.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  fakeGladys,
  defaultState,
  NOW,
  NAS_ID,
  PHOTOS_ID,
  ACCOUNT_ID,
} from './helpers/fixtures.js';

const { account, repositories } = readRound(defaultState(), { now: NOW, staleHours: 26 });
const nas = repositories.find((r) => r.id === NAS_ID);

const PAIRS = new Set([
  `${C.DATA}/${T.DATA.SIZE}/${U.GIGABYTE}`,
  `${C.LEVEL_SENSOR}/${T.SENSOR.DECIMAL}/${U.PERCENT}`,
  `${C.DURATION}/${T.DURATION.DECIMAL}/${U.HOURS}`,
  `${C.COUNTER_SENSOR}/${T.SENSOR.INTEGER}/undefined`,
]);

/**
 * @description Check a device against the host API rules.
 * @param {object} device - The device.
 */
function checkDevice(device) {
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
  for (const feature of device.features) {
    for (const key of ['name', 'external_id', 'category', 'type', 'min', 'max']) {
      assert.notEqual(feature[key], undefined, `${feature.external_id}.${key}`);
    }
    assert.equal(feature.read_only, true);
    assert.equal(feature.has_feedback, false);
    assert.ok(feature.min < feature.max, feature.external_id);
    assert.ok(
      PAIRS.has(`${feature.category}/${feature.type}/${feature.unit}`),
      feature.external_id,
    );
    assert.ok(feature.external_id.startsWith(`${device.external_id}:`));
  }
  assert.equal(new Set(device.features.map((f) => f.external_id)).size, device.features.length);
}

test('one device per repository, on its BorgBase id, complete read-only features', () => {
  const device = buildRepositoryDevice(fakeGladys, nas, 'fr');
  assert.equal(device.name, 'BorgBase nas');
  assert.equal(device.external_id, `ext:borgbase:repo:${NAS_ID}`);
  assert.deepEqual(device.params, [
    { name: 'BORGBASE_REPOSITORY', value: 'nas' },
    { name: 'BORGBASE_REGION', value: 'eu' },
  ]);
  checkDevice(device);
  for (const language of LANGUAGES) {
    const names = buildRepositoryDevice(fakeGladys, nas, language).features.map((f) => f.name);
    assert.equal(new Set(names).size, names.length, language);
  }
});

test('the account device', () => {
  const device = buildAccountDevice(fakeGladys, account, 'de');
  assert.equal(device.name, 'BorgBase-Konto ada@example.com');
  assert.equal(device.external_id, `ext:borgbase:account:${ACCOUNT_ID}`);
  checkDevice(device);
});

test('states: known values only, never 0 for an unknown one', () => {
  const states = (list) =>
    Object.fromEntries(list.map((s) => [s.device_feature_external_id.split(':').pop(), s.state]));
  assert.deepEqual(states(buildRepositoryStates(fakeGladys, nas)), {
    usage: 412.35,
    quota_used: 82.5,
    hours_since_backup: 3,
  });
  const photos = repositories.find((r) => r.id === PHOTOS_ID);
  assert.deepEqual(states(buildRepositoryStates(fakeGladys, photos)), { usage: 0 });
  assert.deepEqual(states(buildAccountStates(fakeGladys, account)), {
    total_usage: 812,
    storage_used: 81.2,
    repositories: 3,
    overdue_repositories: 1,
  });
});

test('external ids are read back, feature suffix or not', () => {
  assert.deepEqual(parseExternalId(`ext:borgbase:repo:${NAS_ID}:usage`), {
    type: 'repo',
    id: NAS_ID,
  });
  assert.deepEqual(parseExternalId(`ext:borgbase:account:${ACCOUNT_ID}`), {
    type: 'account',
    id: ACCOUNT_ID,
  });
  assert.equal(parseExternalId('ext:borgbase:other:x'), null);
  assert.equal(parseExternalId(undefined), null);
});
