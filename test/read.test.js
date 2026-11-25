import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  readAccount,
  readRepository,
  readRound,
  quotaLevel,
  thresholdOf,
  gigabytes,
} from '../src/read.js';
import {
  rawAccount,
  rawRepository,
  defaultState,
  NOW,
  NAS_ID,
  LAPTOP_ID,
  PHOTOS_ID,
} from './helpers/fixtures.js';

const context = { now: NOW, staleHours: 26 };

test('a repository: decimal MB -> GB, quota share, hours since the last write', () => {
  const repository = readRepository(rawRepository(), context);
  assert.equal(repository.id, NAS_ID);
  assert.equal(repository.usageGb, 412.35);
  assert.equal(repository.quotaGb, 500);
  assert.equal(repository.usedPercent, 82.5);
  assert.equal(repository.level, 80);
  assert.equal(repository.hoursSince, 3);
  assert.equal(repository.overdue, false);
  assert.equal(repository.staleAfterHours, 26);
  assert.equal(repository.thresholdSource, 'setting');
  assert.equal(repository.location, 'Helsinki, Finland');
});

test('the BorgBase monitoring of a repository wins over the setting', () => {
  const repository = readRepository(
    rawRepository({ alertDays: 2, lastModified: NOW - 50 * 3600000 }),
    context,
  );
  assert.equal(repository.staleAfterHours, 48);
  assert.equal(repository.thresholdSource, 'borgbase');
  assert.equal(repository.overdue, true);
  assert.deepEqual(thresholdOf(0, 26), { hours: 26, source: 'setting' });
});

test('no quota: share unknown, never 0; never written: counts from the creation', () => {
  const free = readRepository(rawRepository({ quotaEnabled: false }), context);
  assert.equal(free.quotaGb, null);
  assert.equal(free.usedPercent, null);
  assert.equal(free.level, 0);
  const fresh = readRepository(
    rawRepository({ lastModified: null, created: NOW - 2 * 3600000 }),
    context,
  );
  assert.equal(fresh.hoursSince, null);
  assert.equal(fresh.overdue, false);
  const forgotten = readRepository(
    rawRepository({ lastModified: null, created: NOW - 30 * 3600000 }),
    context,
  );
  assert.equal(forgotten.overdue, true, 'created 30 h ago, never written');
});

test('invalid ids are dropped, names fall back to the id', () => {
  assert.equal(readRepository({ id: '../etc' }, context), null);
  assert.equal(readRepository(rawRepository({ name: ' ' }), context).name, NAS_ID);
  assert.equal(gigabytes(-1), null);
  assert.equal(gigabytes('x'), null);
});

test('the account: storage limit share, plan, overage', () => {
  const account = readAccount(rawAccount({ overdue: true }));
  assert.equal(account.usageGb, 812);
  assert.equal(account.limitGb, 1000);
  assert.equal(account.usedPercent, 81.2);
  assert.equal(account.level, 80);
  assert.equal(account.plan, 'Medium');
  assert.deepEqual(account.overage, { amount: 4.2, dueAt: NOW - 86400000, overdue: true });
  assert.equal(readAccount(rawAccount({ limitMb: 0 })).usedPercent, null);
  assert.equal(readAccount(null), null);
  assert.equal(readAccount({ id: 'a b' }), null);
});

test('quota levels: 80, 90, 100', () => {
  assert.equal(quotaLevel(null), 0);
  assert.equal(quotaLevel(79.9), 0);
  assert.equal(quotaLevel(90), 90);
  assert.equal(quotaLevel(130), 100);
});

test('a round: repositories by name, duplicates dropped, overdue count on the account', () => {
  const state = defaultState();
  state.repositories.push(rawRepository());
  const { account, repositories } = readRound(state, context);
  assert.deepEqual(
    repositories.map((r) => r.id),
    [LAPTOP_ID, NAS_ID, PHOTOS_ID],
  );
  assert.equal(account.overdueCount, 1);
  assert.equal(account.repositoryTotal, 3);
  assert.equal(readRound({ account: null, repositories: [] }, context).account, null);
});
