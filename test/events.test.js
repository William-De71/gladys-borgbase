import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildRepositoryEvent, buildAccountEvent } from '../src/events.js';
import { SCENE_TRIGGERS } from '../src/tracker.js';
import { readRound } from '../src/read.js';
import { fakeGladys, defaultState, NOW, NAS_ID, LAPTOP_ID, PHOTOS_ID } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const { account, repositories } = readRound(defaultState(), { now: NOW, staleHours: 26 });
const byId = (id) => repositories.find((r) => r.id === id);

/**
 * @description Check a payload against the core limits and the manifest.
 * @param {{ key: string, data: object }} event - The event.
 */
function check({ key, data }) {
  const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
  assert.ok(trigger, key);
  const declared = new Set([
    ...trigger.variables.map((v) => v.key),
    ...trigger.fields.map((f) => f.key),
  ]);
  assert.ok(Object.keys(data).length <= 30);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(declared.has(name), `${key}.${name} is not declared`);
    assert.ok(['string', 'number', 'boolean'].includes(typeof value), `${key}.${name}`);
    if (typeof value === 'string') {
      assert.ok(value.length <= 1000);
    }
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value));
    }
    const variable = trigger.variables.find((v) => v.key === name);
    if (variable) {
      assert.equal(typeof value, variable.type, `${key}.${name}`);
    }
  }
  for (const variable of trigger.variables) {
    assert.ok(variable.key in data, `${key}.${variable.key} missing`);
  }
}

test('every repository event carries the device, its name and a summary', () => {
  for (const key of [SCENE_TRIGGERS.BACKUP_RECEIVED, SCENE_TRIGGERS.BACKUP_RESUMED]) {
    const event = buildRepositoryEvent(fakeGladys, byId(NAS_ID), { key }, 'en');
    check(event);
    assert.equal(event.data.repository, `ext:borgbase:repo:${NAS_ID}`);
  }
  const overdue = buildRepositoryEvent(
    fakeGladys,
    byId(LAPTOP_ID),
    { key: SCENE_TRIGGERS.BACKUP_OVERDUE },
    'fr',
  );
  check(overdue);
  assert.equal(overdue.data.threshold_hours, 48);
  assert.equal(
    overdue.data.summary,
    'Aucune nouvelle sauvegarde dans le dépôt BorgBase laptop depuis 5 jours.',
  );
  const never = buildRepositoryEvent(
    fakeGladys,
    byId(PHOTOS_ID),
    { key: SCENE_TRIGGERS.BACKUP_OVERDUE },
    'en',
  );
  check(never);
  assert.equal(never.data.hours_since_backup, -1);
  assert.match(never.data.summary, /never received a backup/);
});

test('quota events: repository and account, level as the option value', () => {
  const repository = buildRepositoryEvent(
    fakeGladys,
    byId(NAS_ID),
    { key: SCENE_TRIGGERS.QUOTA_LEVEL_REACHED, level: 80 },
    'de',
  );
  check(repository);
  assert.equal(repository.data.level, '80');
  assert.equal(repository.data.scope, 'repository');
  const level = manifest.scene_triggers
    .find((entry) => entry.key === SCENE_TRIGGERS.QUOTA_LEVEL_REACHED)
    .fields.find((f) => f.key === 'level');
  assert.ok(level.options.some((option) => option.value === repository.data.level));
  const accountEvent = buildAccountEvent(
    fakeGladys,
    account,
    { key: SCENE_TRIGGERS.QUOTA_LEVEL_REACHED, level: 80 },
    'es',
  );
  check(accountEvent);
  assert.equal(accountEvent.data.scope, 'account');
  assert.equal(
    accountEvent.data.summary,
    'La cuenta BorgBase usa el 81.2 % de su límite de almacenamiento de 1000 GB.',
  );
});
