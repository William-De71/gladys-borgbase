// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The three widgets for a BorgBase account of four repositories, on
// 2026-11-25 at 11:00 in Paris: the answers are shaped like the GraphQL
// answers (test/helpers/fixtures.js), read by the real reader (src/read.js)
// and drawn by the real widget builders (src/widgets.js).
//
// The `usage` widget draws the history Gladys keeps of a device feature
// (`device_features`): Gladys draws it from its own database. The
// illustration has no database, so the chart gets the points of a made-up
// history (a slow growth with a prune, seeded, reproducible) as an inline
// series, under the same title and unit.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildOverviewWidget, buildRepositoriesWidget, buildUsageWidget } =
  await load('src/widgets.js');
const { readRound } = await load('src/read.js');
const { LANGUAGES } = await load('src/i18n.js');
const { rawAccount, rawRepository, fakeGladys, NOW } = await load('test/helpers/fixtures.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const HOUR = 3600000;
const DAY = 24 * HOUR;
const answer = {
  account: rawAccount({ diskUsageMb: 836400, limitMb: 1000000 }),
  repositories: [
    rawRepository({
      id: 'y4ab823u',
      name: 'nas-family',
      usageMb: 467800,
      quotaMb: 500000,
      lastModified: NOW - 9 * HOUR,
    }),
    rawRepository({
      id: 'k9qz21mx',
      name: 'laptop-chloe',
      usageMb: 128400,
      quotaEnabled: false,
      quotaMb: 0,
      lastModified: NOW - 4 * DAY - 3 * HOUR,
      alertDays: 2,
    }),
    rawRepository({
      id: 'p3rt77wd',
      name: 'gladys-server',
      usageMb: 18650,
      quotaMb: 50000,
      lastModified: NOW - 2 * HOUR,
    }),
    rawRepository({
      id: 'h2kd90qa',
      name: 'photos-archive',
      usageMb: 221550,
      quotaEnabled: false,
      lastModified: NOW - 20 * HOUR,
      region: 'us',
    }),
  ],
};
const { account, repositories } = readRound(answer, { now: NOW, staleHours: 26 });
const nas = repositories.find((r) => r.name === 'nas-family');

// A month of daily usage of nas-family: steady growth, a prune on day 12.
let seed = 42;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const points = [];
let usage = 431;
for (let day = 30; day >= 0; day -= 1) {
  usage += 1.1 + random() * 0.9 - (day === 12 ? 9 : 0);
  points.push({ t: new Date(NOW - day * DAY).toISOString(), v: Math.round(usage * 10) / 10 });
}
points[points.length - 1].v = nas.usageGb;

const contents = {};
for (const language of LANGUAGES) {
  const common = { language, now: NOW, pollSeconds: 900 };
  const usageWidget = buildUsageWidget({
    ...common,
    gladys: fakeGladys,
    repository: nas,
    account,
    settings: { interval: 'last-month' },
    created: true,
  });
  usageWidget.components = usageWidget.components.map((component) => {
    if (component.type !== 'chart') {
      return component;
    }
    const { device_features: _features, interval: _interval, ...rest } = component;
    return { ...rest, series: [{ name: nas.name, points }] };
  });
  contents[language] = {
    overview: buildOverviewWidget({ ...common, account, repositories }),
    repositories: buildRepositoriesWidget({ ...common, repositories, settings: { count: 4 } }),
    usage: usageWidget,
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
