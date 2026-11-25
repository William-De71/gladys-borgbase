import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildOverviewWidget,
  buildRepositoriesWidget,
  buildUsageWidget,
  formatSize,
  readCount,
  messageContent,
} from '../src/widgets.js';
import { readRound } from '../src/read.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, defaultState, rawAccount, NOW, NAS_ID } from './helpers/fixtures.js';

const { account, repositories } = readRound(defaultState(), { now: NOW, staleHours: 26 });
const nas = repositories.find((r) => r.id === NAS_ID);
const valid = (content, label) => assert.deepEqual(validateWidgetContent(content), [], label);
const BUDGET = { max: 8, tiles: 6 };

/**
 * @description The card budget of the core.
 * @param {object} content - The content.
 */
function withinBudget(content) {
  assert.ok(content.components.length <= BUDGET.max);
  const tiles = content.components.filter((c) => ['value', 'gauge'].includes(c.type));
  assert.ok(tiles.length <= BUDGET.tiles);
  const focal = content.components.filter((c) => ['chart', 'card-list', 'image'].includes(c.type));
  assert.ok(focal.length <= 1);
}

test('overview: gauge, tiles, what needs attention, a link; valid in every language', () => {
  for (const language of LANGUAGES) {
    const content = buildOverviewWidget({
      account,
      repositories,
      language,
      now: NOW,
      pollSeconds: 900,
    });
    valid(content, language);
    withinBudget(content);
  }
  const content = buildOverviewWidget({
    account,
    repositories,
    language: 'en',
    now: NOW,
    pollSeconds: 900,
  });
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['text', 'gauge', 'value', 'value', 'value', 'status', 'button'],
  );
  assert.equal(content.components[0].text, 'BorgBase Medium');
  assert.equal(content.components[2].value, '812 GB');
  const rows = content.components[5].items;
  assert.deepEqual(
    rows.map((row) => [row.label, row.value, row.color]),
    [['laptop', '5 d ago', 'danger']],
  );
  assert.equal(content.ttl_seconds, 900);
});

test('overview: an unpaid overage first, all recent when nothing is wrong, no account', () => {
  const overdue = readRound(
    { ...defaultState(), account: rawAccount({ overdue: true }) },
    { now: NOW, staleHours: 26 },
  );
  const rows = buildOverviewWidget({
    ...overdue,
    language: 'fr',
    now: NOW,
    pollSeconds: 900,
  }).components.find((c) => c.type === 'status').items;
  assert.equal(rows[0].label, 'Facture de dépassement impayée');
  const fine = [nas];
  const allGood = buildOverviewWidget({
    account: null,
    repositories: fine,
    language: 'en',
    now: NOW,
    pollSeconds: 900,
  });
  valid(allGood);
  assert.equal(allGood.components[0].type, 'value', 'no plan heading, no gauge');
  assert.deepEqual(allGood.components.find((c) => c.type === 'status').items[0], {
    label: 'All backups recent',
    value: '3 h ago',
    color: 'success',
  });
});

test('repositories: attention first, badges, sizes and relative times', () => {
  for (const language of LANGUAGES) {
    const content = buildRepositoriesWidget({
      repositories,
      language,
      settings: {},
      now: NOW,
      pollSeconds: 900,
    });
    valid(content, language);
  }
  const { items } = buildRepositoriesWidget({
    repositories,
    language: 'en',
    settings: {},
    now: NOW,
    pollSeconds: 900,
  }).components[0];
  assert.deepEqual(
    items.map((item) => [item.title, item.badge.text, item.subtitle]),
    [
      ['laptop', 'Overdue', '98 GB · 5 d ago'],
      ['photos', 'Empty', '0 MB · never backed up'],
      ['nas', 'OK', '412 GB · 83 % of quota · 3 h ago'],
    ],
  );
  assert.match(items[0].description, /Overdue after 2 days/);
  const sized = buildRepositoriesWidget({
    repositories,
    language: 'en',
    settings: { order: 'usage', count: 2 },
    now: NOW,
    pollSeconds: 900,
  });
  valid(sized);
  assert.deepEqual(
    sized.components[0].items.map((i) => i.title),
    ['nas', 'laptop'],
  );
  assert.equal(sized.components[1].text, '2 of 3 repositories');
  valid(buildRepositoriesWidget({ repositories: [], language: 'de', now: NOW, pollSeconds: 900 }));
});

test('usage: the history Gladys keeps, once the device exists', () => {
  for (const language of LANGUAGES) {
    for (const created of [true, false]) {
      valid(
        buildUsageWidget({
          gladys: fakeGladys,
          repository: nas,
          account,
          language,
          created,
          pollSeconds: 900,
        }),
        language,
      );
    }
  }
  const chart = buildUsageWidget({
    gladys: fakeGladys,
    repository: nas,
    account,
    language: 'en',
    settings: { interval: 'last-year' },
    created: true,
    pollSeconds: 900,
  }).components.find((c) => c.type === 'chart');
  assert.deepEqual(chart.device_features, [`ext:borgbase:repo:${NAS_ID}:usage`]);
  assert.equal(chart.interval, 'last-year');
  const whole = buildUsageWidget({
    gladys: fakeGladys,
    repository: null,
    account,
    language: 'fr',
    settings: { interval: 'bogus' },
    created: true,
    pollSeconds: 900,
  });
  valid(whole);
  assert.equal(whole.components[0].text, 'Tout le compte');
  assert.equal(whole.components.at(-1).interval, 'last-month');
  assert.match(
    buildUsageWidget({
      gladys: fakeGladys,
      repository: nas,
      account,
      language: 'en',
      created: false,
      pollSeconds: 900,
    }).components.at(-1).text,
    /Discovery/,
  );
});

test('helpers: sizes, counts, messages', () => {
  assert.equal(formatSize(1240, 'en'), '1.24 TB');
  assert.equal(formatSize(12.34, 'fr'), '12,3 Go');
  assert.equal(formatSize(0.85, 'en'), '850 MB');
  assert.equal(formatSize(null, 'en'), '–');
  assert.equal(readCount('99'), 12);
  assert.equal(readCount(undefined), 8);
  valid(messageContent('x'.repeat(500)));
});
