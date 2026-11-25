import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SCENE_ACTIONS,
  buildRepositoryOutputs,
  buildAccountOutputs,
  statusOf,
} from '../src/scene-actions.js';
import { readRound } from '../src/read.js';
import { defaultState, NOW, NAS_ID, LAPTOP_ID, PHOTOS_ID } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const { account, repositories } = readRound(defaultState(), { now: NOW, staleHours: 26 });
const byId = (id) => repositories.find((r) => r.id === id);

/**
 * @description The outputs match the declared ones, with their types.
 * @param {string} key - The action key.
 * @param {object} outputs - The outputs.
 */
function check(key, outputs) {
  const declared = manifest.scene_actions.find((action) => action.key === key).outputs;
  assert.deepEqual(Object.keys(outputs).sort(), declared.map((o) => o.key).sort(), key);
  for (const output of declared) {
    assert.equal(typeof outputs[output.key], output.type, `${key}.${output.key}`);
  }
}

test('get_repository: figures, status and a summary; unknown numbers are -1', () => {
  const nas = buildRepositoryOutputs(byId(NAS_ID), 'en');
  check(SCENE_ACTIONS.GET_REPOSITORY, nas);
  assert.equal(nas.status, 'ok');
  assert.equal(nas.summary, 'nas: 412.35 GB. Last backup 3 h ago. Quota used: 82.5 %.');
  const laptop = buildRepositoryOutputs(byId(LAPTOP_ID), 'fr');
  assert.equal(laptop.status, 'overdue');
  assert.equal(laptop.quota_gb, -1);
  assert.equal(laptop.overdue, true);
  const photos = buildRepositoryOutputs(byId(PHOTOS_ID), 'en');
  assert.equal(photos.hours_since_backup, -1);
  assert.equal(photos.last_backup, '');
  assert.equal(statusOf({ lastBackupAt: null, overdue: true }), 'never');
});

test('get_account: totals and the overdue repositories, even without the account', () => {
  const outputs = buildAccountOutputs(account, repositories, 'en');
  check(SCENE_ACTIONS.GET_ACCOUNT, outputs);
  assert.equal(outputs.overdue_names, 'laptop');
  assert.equal(
    outputs.summary,
    '3 BorgBase repositories, 812 GB in all. Storage limit used: 81.2 % of 1000 GB. Overdue backups (1): laptop.',
  );
  const blind = buildAccountOutputs(null, repositories, 'en');
  check(SCENE_ACTIONS.GET_ACCOUNT, blind);
  assert.equal(blind.usage_gb, 510.35);
  assert.equal(blind.storage_limit_gb, -1);
  assert.equal(blind.plan, '');
});
