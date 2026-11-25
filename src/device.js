// -----------------------------------------------------------------------------
// The devices of the BorgBase integration, offered on the Discovery screen.
//
// Category / type pairs come from DEVICE_FEATURE_CATEGORIES of the SDK, with
// an icon and units in the Gladys front. Gladys has no "fill rate" category:
// `level-sensor` / `decimal` in % is its plain numeric level (as for a file
// system), the feature name tells what it measures.
//
// One device per repository, "BorgBase <repository>":
//   - usage              data / size, GB (decimal gigabytes)
//   - quota_used         level-sensor / decimal, % of the repository quota
//                        (published only when a quota is set)
//   - hours_since_backup duration / decimal, hours since the last write
//                        (not published before the first backup): a scene
//                        condition compares it to any delay
// One device for the account, "BorgBase <user name>" (when the token reads it):
//   - total_usage        data / size, GB
//   - storage_used       level-sensor / decimal, % of the storage limit
//   - repositories       counter-sensor / integer
//   - overdue_repositories counter-sensor / integer
//
// External ids are built on the BorgBase ids (the 8-character repository id,
// the account id), never on a name: renaming a repository keeps its device.
//
// BorgBase is read on the integration's own timer (every 15 min by
// default, beyond the 60 s Gladys polls at most), so `should_poll` is false.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';

const DEVICE_TYPES = { REPOSITORY: 'repo', ACCOUNT: 'account' };

// 1 PB: far beyond any BorgBase plan.
const MAX_GIGABYTES = 1000000;
// Ten years without a backup.
const MAX_HOURS = 87600;
const MAX_COUNT = 10000;

const sensor = { read_only: true, has_feedback: false, keep_history: true };
const size = {
  ...sensor,
  category: CATEGORIES.DATA,
  type: TYPES.DATA.SIZE,
  unit: UNITS.GIGABYTE,
  min: 0,
  max: MAX_GIGABYTES,
};
const share = {
  ...sensor,
  category: CATEGORIES.LEVEL_SENSOR,
  type: TYPES.SENSOR.DECIMAL,
  unit: UNITS.PERCENT,
  min: 0,
  max: 100,
};
const counter = (max) => ({
  ...sensor,
  category: CATEGORIES.COUNTER_SENSOR,
  type: TYPES.SENSOR.INTEGER,
  min: 0,
  max,
});

const bounded = (value, max) =>
  value === null || value === undefined ? null : Math.min(value, max);

// The features of each device: key, name (TEXTS key), shape, and the state of
// a snapshot (a number, or null when unknown: not published).
const REPOSITORY_FEATURES = [
  {
    key: 'usage',
    name: 'featureUsage',
    shape: size,
    state: (r) => bounded(r.usageGb, MAX_GIGABYTES),
  },
  {
    key: 'quota_used',
    name: 'featureQuotaUsed',
    shape: share,
    state: (r) => bounded(r.usedPercent, 100),
  },
  {
    key: 'hours_since_backup',
    name: 'featureHoursSinceBackup',
    shape: {
      ...sensor,
      category: CATEGORIES.DURATION,
      type: TYPES.DURATION.DECIMAL,
      unit: UNITS.HOURS,
      min: 0,
      max: MAX_HOURS,
    },
    state: (r) => bounded(r.hoursSince, MAX_HOURS),
  },
];

const ACCOUNT_FEATURES = [
  {
    key: 'total_usage',
    name: 'featureTotalUsage',
    shape: size,
    state: (a) => bounded(a.usageGb, MAX_GIGABYTES),
  },
  {
    key: 'storage_used',
    name: 'featureStorageUsed',
    shape: share,
    state: (a) => bounded(a.usedPercent, 100),
  },
  {
    key: 'repositories',
    name: 'featureRepositories',
    shape: counter(MAX_COUNT),
    state: (a) => bounded(a.repositoryTotal, MAX_COUNT),
  },
  {
    key: 'overdue_repositories',
    name: 'featureOverdueRepositories',
    shape: counter(MAX_COUNT),
    state: (a) => bounded(a.overdueCount, MAX_COUNT),
  },
];

/**
 * @description The external ids of a repository or of the account.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} type - A DEVICE_TYPES value.
 * @param {string} id - The BorgBase id.
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, 'repo', 'y4ab823u').device; // -> 'ext:borgbase:repo:y4ab823u'
 */
function idsOf(gladys, type, id) {
  return gladys.externalIds(type, String(id).toLowerCase());
}

/**
 * @description What a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {{ type: string, id: string }|null} The type and BorgBase id.
 * @example
 * parseExternalId('ext:borgbase:repo:y4ab823u:usage'); // -> { type: 'repo', id: 'y4ab823u' }
 */
function parseExternalId(externalId) {
  const match = /:(repo|account):([a-z0-9_-]{1,64})(?::[a-z_]+)?$/i.exec(String(externalId ?? ''));
  return match ? { type: match[1], id: match[2].toLowerCase() } : null;
}

/**
 * @description The features of a device.
 * @param {object} ids - From idsOf.
 * @param {object[]} specs - REPOSITORY_FEATURES or ACCOUNT_FEATURES.
 * @param {string} language - Language of the names.
 * @returns {object[]} The features.
 */
function featuresOf(ids, specs, language) {
  return specs.map((spec) => ({
    name: t(spec.name, language),
    external_id: ids.feature(spec.key),
    ...spec.shape,
  }));
}

/**
 * @description The device of a repository.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} repository - The repository snapshot.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildRepositoryDevice(gladys, repository, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.REPOSITORY, repository.id);
  return {
    name: t('repositoryDeviceName', language, { name: repository.name }),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'BORGBASE_REPOSITORY', value: repository.name },
      { name: 'BORGBASE_REGION', value: repository.region || '?' },
    ],
    features: featuresOf(ids, REPOSITORY_FEATURES, language),
  };
}

/**
 * @description The device of the account.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} account - The account snapshot.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildAccountDevice(gladys, account, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id);
  return {
    name: t('accountDeviceName', language, { name: account.username || account.id }),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: 'BORGBASE_PLAN', value: account.plan || '?' }],
    features: featuresOf(ids, ACCOUNT_FEATURES, language),
  };
}

/**
 * @description The states of a device: an unknown value is omitted.
 * @param {object} ids - From idsOf.
 * @param {object[]} specs - The feature specs.
 * @param {object} snapshot - The snapshot.
 * @returns {object[]} The states.
 */
function statesOf(ids, specs, snapshot) {
  return specs.flatMap((spec) => {
    const value = spec.state(snapshot);
    return Number.isFinite(value)
      ? [{ device_feature_external_id: ids.feature(spec.key), state: value }]
      : [];
  });
}

/**
 * @description The states of a repository.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} repository - The snapshot.
 * @returns {object[]} The states.
 */
function buildRepositoryStates(gladys, repository) {
  return statesOf(
    idsOf(gladys, DEVICE_TYPES.REPOSITORY, repository.id),
    REPOSITORY_FEATURES,
    repository,
  );
}

/**
 * @description The states of the account.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} account - The snapshot.
 * @returns {object[]} The states.
 */
function buildAccountStates(gladys, account) {
  return statesOf(idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id), ACCOUNT_FEATURES, account);
}

export {
  DEVICE_TYPES,
  REPOSITORY_FEATURES,
  ACCOUNT_FEATURES,
  idsOf,
  parseExternalId,
  buildRepositoryDevice,
  buildAccountDevice,
  buildRepositoryStates,
  buildAccountStates,
};
