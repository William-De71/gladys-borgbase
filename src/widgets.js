// -----------------------------------------------------------------------------
// Dashboard widgets of the BorgBase integration.
//
//   - `overview`      the account at a glance: storage used (gauge), total
//                     usage, repositories, overdue backups, and the
//                     repositories that need attention;
//   - `repositories`  every repository with its usage, last backup and a
//                     badge (OK, overdue, never, quota);
//   - `usage`         the usage history of a repository (or of the account),
//                     from the history Gladys keeps of the device feature.
//
// The contents come from the snapshots of the last round: a widget never
// costs a BorgBase call. Every text exists in the four languages (the content
// is cached per language).
// -----------------------------------------------------------------------------

import { DEVICE_TYPES, idsOf } from './device.js';
import { t, ago, duration } from './i18n.js';

const WIDGETS = {
  OVERVIEW: 'overview',
  REPOSITORIES: 'repositories',
  USAGE: 'usage',
};

const LIST_COUNT = { min: 1, max: 12, default: 8 };
const ORDERS = ['attention', 'name', 'usage'];
const INTERVALS = ['last-week', 'last-month', 'last-three-months', 'last-year'];
const TTL = { min: 60, max: 3600, message: 300 };
// The overview names at most this many repositories needing attention.
const MAX_ATTENTION_ROWS = 4;
const BORGBASE_URL = 'https://www.borgbase.com/repositories';

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 * @example
 * clip('A very long name', 10); // -> 'A very lo…'
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description The freshness of a content: the poll interval, bounded.
 * @param {number} pollSeconds - The poll interval.
 * @returns {number} The TTL in seconds.
 */
function ttlOf(pollSeconds) {
  return Math.min(TTL.max, Math.max(TTL.min, Math.round(pollSeconds)));
}

/**
 * @description Read a bounded integer setting.
 * @param {unknown} raw - The raw setting.
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 */
function readCount(raw, bounds = LIST_COUNT) {
  const value = Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 * @example
 * messageContent('No repository');
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description A size for a tile or a line: "12.3 GB", "1.24 TB", "850 MB"
 * (Go, To, Mo in French, as the Gladys interface writes them).
 * @param {number|null} gigabytes - The size in decimal GB.
 * @param {string} language - The language (decimal separator).
 * @returns {string} The text, '–' when unknown.
 */
function formatSize(gigabytes, language) {
  if (!Number.isFinite(gigabytes)) {
    return '–';
  }
  const units =
    language === 'fr' ? { tb: 'To', gb: 'Go', mb: 'Mo' } : { tb: 'TB', gb: 'GB', mb: 'MB' };
  const format = (value, digits) =>
    value.toLocaleString(language, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  if (gigabytes >= 1000) {
    return `${format(gigabytes / 1000, 2)} ${units.tb}`;
  }
  if (gigabytes < 1) {
    return `${format(gigabytes * 1000, 0)} ${units.mb}`;
  }
  return `${format(gigabytes, gigabytes >= 100 ? 0 : 1)} ${units.gb}`;
}

/**
 * @description The badge and the attention rank of a repository.
 * @param {object} repository - The snapshot.
 * @param {string} language - The language.
 * @returns {{ text: string, color: string, rank: number }} Higher rank first.
 */
function badgeOf(repository, language) {
  if (repository.overdue) {
    return repository.lastBackupAt === null
      ? { text: t('badgeNever', language), color: 'danger', rank: 3 }
      : { text: t('badgeOverdue', language), color: 'danger', rank: 3 };
  }
  if (repository.level >= 90) {
    return {
      text: t('badgeQuota', language, { percent: Math.round(repository.usedPercent) }),
      color: repository.level >= 100 ? 'danger' : 'warning',
      rank: 2,
    };
  }
  if (repository.lastBackupAt === null) {
    return { text: t('badgeEmpty', language), color: 'neutral', rank: 1 };
  }
  return { text: t('badgeOk', language), color: 'success', rank: 0 };
}

/**
 * @description "4 h ago" for the last backup, or "never".
 * @param {object} repository - The snapshot.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function lastBackupText(repository, now, language) {
  return repository.lastBackupAt === null
    ? t('neverBackedUp', language)
    : ago(repository.lastBackupAt, now, language);
}

/**
 * @description The `overview` widget.
 * @param {object} options - Options.
 * @param {object|null} options.account - The account snapshot.
 * @param {object[]} options.repositories - The repositories.
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now, in ms.
 * @param {number} options.pollSeconds - The poll interval.
 * @returns {object} The content.
 * @example
 * buildOverviewWidget({ account, repositories, language: 'fr', now: Date.now(), pollSeconds: 900 });
 */
function buildOverviewWidget({ account, repositories, language, now, pollSeconds }) {
  const usage =
    account?.usageGb ??
    repositories.reduce((sum, repository) => sum + (repository.usageGb ?? 0), 0);
  const overdue = repositories.filter((repository) => repository.overdue);
  const components = [];
  if (account?.plan) {
    components.push({
      type: 'text',
      variant: 'heading',
      text: clip(t('planHeading', language, { plan: account.plan }), 40),
    });
  }
  if (Number.isFinite(account?.usedPercent)) {
    components.push({
      type: 'gauge',
      value: Math.min(100, account.usedPercent),
      min: 0,
      max: 100,
      unit: '%',
      label: t('storageUsed', language),
      color: account.level >= 90 ? 'danger' : account.level >= 80 ? 'warning' : 'success',
    });
  }
  components.push(
    {
      type: 'value',
      value: clip(formatSize(usage, language), 12),
      label: t('totalUsage', language),
      icon: 'hard-drive',
      color: 'primary',
    },
    {
      type: 'value',
      value: account?.repositoryTotal ?? repositories.length,
      label: t('repositories', language),
      icon: 'database',
    },
    {
      type: 'value',
      value: overdue.length,
      label: t('overdueBackups', language),
      icon: overdue.length > 0 ? 'alert-triangle' : 'check-circle',
      color: overdue.length > 0 ? 'danger' : 'success',
    },
  );
  const attention = repositories
    .map((repository) => ({ repository, badge: badgeOf(repository, language) }))
    .filter((entry) => entry.badge.rank >= 2)
    .sort(
      (a, b) => b.badge.rank - a.badge.rank || a.repository.name.localeCompare(b.repository.name),
    );
  const items = attention.slice(0, MAX_ATTENTION_ROWS).map(({ repository, badge }) => ({
    label: clip(repository.name, 40),
    value: clip(repository.overdue ? lastBackupText(repository, now, language) : badge.text, 40),
    color: badge.color,
  }));
  if (attention.length > MAX_ATTENTION_ROWS) {
    items.push({
      label: t('moreRepositories', language, { n: attention.length - MAX_ATTENTION_ROWS }),
      value: '…',
      color: 'warning',
    });
  }
  if (account?.overage?.overdue) {
    items.unshift({
      label: t('overageOverdue', language),
      value: Number.isFinite(account.overage.amount)
        ? `$${account.overage.amount.toFixed(2)}`
        : '!',
      color: 'danger',
    });
  }
  if (items.length === 0 && repositories.length > 0) {
    items.push({
      label: t('allBackupsRecent', language),
      value: lastBackupText(
        repositories.reduce((latest, repository) =>
          (repository.lastBackupAt ?? 0) > (latest.lastBackupAt ?? 0) ? repository : latest,
        ),
        now,
        language,
      ),
      color: 'success',
    });
  }
  if (items.length > 0) {
    components.push({ type: 'status', items });
  }
  components.push({
    type: 'button',
    label: t('openBorgBase', language),
    icon: 'external-link',
    style: 'secondary',
    link: { url: BORGBASE_URL },
  });
  return { ttl_seconds: ttlOf(pollSeconds), components };
}

/**
 * @description The `repositories` widget.
 * @param {object} options - Options.
 * @param {object[]} options.repositories - The repositories.
 * @param {string} options.language - The user language.
 * @param {object} [options.settings] - `{ order, count }`.
 * @param {number} options.now - Now, in ms.
 * @param {number} options.pollSeconds - The poll interval.
 * @returns {object} The content.
 */
function buildRepositoriesWidget({ repositories, language, settings = {}, now, pollSeconds }) {
  if (repositories.length === 0) {
    return messageContent(t('noRepository', language));
  }
  const order = ORDERS.includes(settings.order) ? settings.order : 'attention';
  const entries = repositories.map((repository) => ({
    repository,
    badge: badgeOf(repository, language),
  }));
  const byName = (a, b) => a.repository.name.localeCompare(b.repository.name);
  const sorters = {
    attention: (a, b) =>
      b.badge.rank - a.badge.rank ||
      (b.repository.hoursSince ?? 0) - (a.repository.hoursSince ?? 0) ||
      byName(a, b),
    name: byName,
    usage: (a, b) => (b.repository.usageGb ?? 0) - (a.repository.usageGb ?? 0) || byName(a, b),
  };
  const shown = entries.sort(sorters[order]).slice(0, readCount(settings.count));
  const items = shown.map(({ repository, badge }) => {
    const quota = Number.isFinite(repository.usedPercent)
      ? t('quotaShort', language, { percent: Math.round(repository.usedPercent) })
      : '';
    const size = formatSize(repository.usageGb, language);
    const last = lastBackupText(repository, now, language);
    const threshold = t('thresholdLine', language, {
      since: duration(repository.staleAfterHours, language),
    });
    return {
      title: clip(repository.name, 60),
      subtitle: clip([size, quota, last].filter(Boolean).join(' · '), 60),
      description: clip(
        [
          t('lineUsage', language, {
            size,
            quota: Number.isFinite(repository.quotaGb)
              ? formatSize(repository.quotaGb, language)
              : t('noQuota', language),
          }),
          t('lineLastBackup', language, { last }),
          threshold,
          [repository.region.toUpperCase(), repository.location, repository.format]
            .filter(Boolean)
            .join(' · '),
          repository.appendOnly ? t('appendOnly', language) : '',
        ]
          .filter(Boolean)
          .join(' · '),
        2000,
      ),
      badge: { text: clip(badge.text, 16), color: badge.color },
      links: [{ url: BORGBASE_URL, label: 'BorgBase' }],
    };
  });
  const components = [{ type: 'card-list', display: 'list', items }];
  if (repositories.length > shown.length) {
    components.push({
      type: 'text',
      variant: 'caption',
      text: clip(t('shownOf', language, { shown: shown.length, total: repositories.length }), 80),
    });
  }
  return { ttl_seconds: ttlOf(pollSeconds), components };
}

/**
 * @description The `usage` widget: the usage history Gladys keeps of a
 * device feature (repository usage, or account total), with the current
 * figures as tiles.
 * @param {object} options - Options.
 * @param {object} options.gladys - The GladysIntegration instance (external ids).
 * @param {object|null} options.repository - The chosen repository, or null for the account.
 * @param {object|null} options.account - The account snapshot.
 * @param {string} options.language - The user language.
 * @param {object} [options.settings] - `{ interval }`.
 * @param {boolean} options.created - Whether the device of the chart exists in Gladys.
 * @param {number} options.pollSeconds - The poll interval.
 * @returns {object} The content.
 */
function buildUsageWidget({
  gladys,
  repository,
  account,
  language,
  settings = {},
  created,
  pollSeconds,
}) {
  const interval = INTERVALS.includes(settings.interval) ? settings.interval : 'last-month';
  const target = repository
    ? { ids: idsOf(gladys, DEVICE_TYPES.REPOSITORY, repository.id), feature: 'usage' }
    : account
      ? { ids: idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id), feature: 'total_usage' }
      : null;
  if (!target) {
    return messageContent(t('noRepository', language));
  }
  const name = repository ? repository.name : t('wholeAccount', language);
  const components = [{ type: 'text', variant: 'heading', text: clip(name, 40) }];
  const usage = repository ? repository.usageGb : account.usageGb;
  components.push({
    type: 'value',
    value: clip(formatSize(usage, language), 12),
    label: t(repository ? 'featureUsage' : 'totalUsage', language),
    icon: 'hard-drive',
    color: 'primary',
  });
  const share = repository ? repository.usedPercent : account.usedPercent;
  if (Number.isFinite(share)) {
    components.push({
      type: 'value',
      value: Math.round(share),
      unit: '%',
      label: t(repository ? 'featureQuotaUsed' : 'storageUsed', language),
      icon: 'pie-chart',
      color: share >= 90 ? 'danger' : share >= 80 ? 'warning' : 'success',
    });
  }
  if (created) {
    components.push({
      type: 'chart',
      device_features: [target.ids.feature(target.feature)],
      interval,
      chart_type: 'area',
      title: t('usageHistory', language),
      unit: language === 'fr' ? 'Go' : 'GB',
    });
  } else {
    components.push({ type: 'text', variant: 'body', text: t('createDeviceForHistory', language) });
  }
  return { ttl_seconds: ttlOf(pollSeconds), components };
}

export {
  WIDGETS,
  LIST_COUNT,
  ORDERS,
  INTERVALS,
  BORGBASE_URL,
  messageContent,
  readCount,
  formatSize,
  badgeOf,
  buildOverviewWidget,
  buildRepositoriesWidget,
  buildUsageWidget,
};
