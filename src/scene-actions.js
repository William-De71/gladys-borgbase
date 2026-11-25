// -----------------------------------------------------------------------------
// Scene actions of the integration.
//
//   - `get_repository`  the figures of a repository (or of the first one),
//                       for a message or a condition;
//   - `get_account`     the figures of the account: usage, storage limit,
//                       repositories, overdue backups.
//
// Both read the last round, or BorgBase again when it is older than a minute.
// They never fire a scene event. Unknown numbers are -1, never 0.
// -----------------------------------------------------------------------------

import { t, duration } from './i18n.js';

const SCENE_ACTIONS = {
  GET_REPOSITORY: 'get_repository',
  GET_ACCOUNT: 'get_account',
};

const numberOr = (value) => (Number.isFinite(value) ? value : -1);
const iso = (value) => (Number.isFinite(value) ? new Date(value).toISOString() : '');

/**
 * @description The status word of a repository.
 * @param {object} repository - The snapshot.
 * @returns {string} `ok`, `overdue` or `never`.
 */
function statusOf(repository) {
  if (repository.lastBackupAt === null) {
    return repository.overdue ? 'never' : 'ok';
  }
  return repository.overdue ? 'overdue' : 'ok';
}

/**
 * @description The outputs of `get_repository`.
 * @param {object} repository - The snapshot.
 * @param {string} language - Language of the summary.
 * @returns {object} The outputs.
 */
function buildRepositoryOutputs(repository, language) {
  const status = statusOf(repository);
  const parts = [
    t('outputRepository', language, {
      name: repository.name,
      usage: repository.usageGb ?? '?',
    }),
  ];
  if (repository.lastBackupAt !== null) {
    parts.push(
      t('outputLastBackup', language, { since: duration(repository.hoursSince, language) }),
    );
  } else {
    parts.push(t('outputNoBackup', language));
  }
  if (repository.usedPercent !== null) {
    parts.push(t('outputQuota', language, { percent: repository.usedPercent }));
  }
  return {
    repository_name: repository.name,
    status,
    usage_gb: numberOr(repository.usageGb),
    quota_gb: numberOr(repository.quotaGb),
    used_percent: numberOr(repository.usedPercent),
    hours_since_backup: numberOr(repository.hoursSince),
    last_backup: iso(repository.lastBackupAt),
    overdue: repository.overdue,
    region: repository.region,
    summary: parts.join(' '),
  };
}

/**
 * @description The outputs of `get_account`.
 * @param {object} account - The account snapshot (null when unreadable).
 * @param {object[]} repositories - The repositories.
 * @param {string} language - Language of the summary.
 * @returns {object} The outputs.
 */
function buildAccountOutputs(account, repositories, language) {
  const usage =
    account?.usageGb ??
    Math.round(repositories.reduce((sum, repository) => sum + (repository.usageGb ?? 0), 0) * 100) /
      100;
  const overdue = repositories.filter((repository) => repository.overdue);
  const count = account?.repositoryTotal ?? repositories.length;
  const summary = [
    t('outputAccount', language, { count, usage }),
    account?.usedPercent !== null && account?.usedPercent !== undefined
      ? t('outputStorage', language, { percent: account.usedPercent, limit: account.limitGb })
      : '',
    overdue.length > 0
      ? t('outputOverdue', language, {
          count: overdue.length,
          names: overdue.map((repository) => repository.name).join(', '),
        })
      : t('outputAllRecent', language),
  ]
    .filter(Boolean)
    .join(' ');
  return {
    plan: account?.plan ?? '',
    usage_gb: numberOr(usage),
    storage_limit_gb: numberOr(account?.limitGb),
    used_percent: numberOr(account?.usedPercent),
    repositories: count,
    overdue_repositories: overdue.length,
    overdue_names: overdue.map((repository) => repository.name).join(', '),
    summary: summary.slice(0, 10000),
  };
}

export { SCENE_ACTIONS, statusOf, buildRepositoryOutputs, buildAccountOutputs };
