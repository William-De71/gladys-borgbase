import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diffRepository, diffAccount, SCENE_TRIGGERS } from '../src/tracker.js';

const repo = (overrides = {}) => ({
  lastBackupAt: 1000,
  overdue: false,
  level: 0,
  ...overrides,
});
const keys = (events) => events.map((event) => event.key);

test('the first sight of a repository is a baseline', () => {
  assert.deepEqual(diffRepository(null, repo({ overdue: true, level: 100 })), []);
});

test('a write fires backup_received; after an overdue period, backup_resumed too', () => {
  assert.deepEqual(keys(diffRepository(repo(), repo({ lastBackupAt: 2000 }))), [
    SCENE_TRIGGERS.BACKUP_RECEIVED,
  ]);
  assert.deepEqual(keys(diffRepository(repo({ overdue: true }), repo({ lastBackupAt: 2000 }))), [
    SCENE_TRIGGERS.BACKUP_RECEIVED,
    SCENE_TRIGGERS.BACKUP_RESUMED,
  ]);
  assert.deepEqual(
    keys(diffRepository(repo({ lastBackupAt: null }), repo({ lastBackupAt: 5 }))),
    [SCENE_TRIGGERS.BACKUP_RECEIVED],
    'the very first backup',
  );
  assert.deepEqual(diffRepository(repo(), repo()), [], 'nothing changed');
});

test('becoming overdue fires once, staying overdue does not', () => {
  assert.deepEqual(keys(diffRepository(repo(), repo({ overdue: true }))), [
    SCENE_TRIGGERS.BACKUP_OVERDUE,
  ]);
  assert.deepEqual(diffRepository(repo({ overdue: true }), repo({ overdue: true })), []);
});

test('a higher quota level fires with the level; going down does not', () => {
  assert.deepEqual(diffRepository(repo({ level: 80 }), repo({ level: 100 })), [
    { key: SCENE_TRIGGERS.QUOTA_LEVEL_REACHED, level: 100 },
  ]);
  assert.deepEqual(diffRepository(repo({ level: 90 }), repo({ level: 80 })), []);
});

test('the account: storage limit levels only, same account only', () => {
  assert.deepEqual(diffAccount({ id: 'a', level: 0 }, { id: 'a', level: 80 }), [
    { key: SCENE_TRIGGERS.QUOTA_LEVEL_REACHED, level: 80 },
  ]);
  assert.deepEqual(diffAccount({ id: 'a', level: 0 }, { id: 'b', level: 80 }), []);
  assert.deepEqual(diffAccount(null, { id: 'a', level: 80 }), []);
  assert.deepEqual(diffAccount({ id: 'a', level: 80 }, null), []);
});
