// -----------------------------------------------------------------------------
// Scene events of the integration.
//
// The tracker says what happened; this module writes the flat `data` of the
// event the core matches against the scene triggers. Every event carries:
//   - `repository`       the device external id (repository or account): the
//                        value of the "Repository" filter (a `source:
//                        "devices"` select);
//   - `repository_name`  the repository name (the user name for the account);
//   - `summary`          a sentence ready to put in a message;
// plus the fields of its kind. Values are scalars, texts cut at 1,000
// characters. `level` is compared by equality by the core: it carries the
// option value ("80", "90", "100").
// -----------------------------------------------------------------------------

import { SCENE_TRIGGERS } from './tracker.js';
import { DEVICE_TYPES, idsOf } from './device.js';
import { t, duration } from './i18n.js';

const MAX_TEXT = 1000;

const clip = (value) => String(value ?? '').slice(0, MAX_TEXT);
const numberOr = (value, fallback = -1) => (Number.isFinite(value) ? value : fallback);
const iso = (value) => (Number.isFinite(value) ? new Date(value).toISOString() : '');

/**
 * @description The event of a repository transition.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} repository - The repository snapshot.
 * @param {object} event - From diffRepository.
 * @param {string} language - Language of the summary.
 * @returns {{ key: string, data: object }} The event.
 * @example
 * const { key, data } = buildRepositoryEvent(gladys, repository, event, 'fr');
 * await gladys.publishSceneEvent(key, data);
 */
function buildRepositoryEvent(gladys, repository, event, language) {
  const data = {
    repository: idsOf(gladys, DEVICE_TYPES.REPOSITORY, repository.id).device,
    repository_name: clip(repository.name),
    usage_gb: numberOr(repository.usageGb),
  };
  const values = { name: repository.name };
  switch (event.key) {
    case SCENE_TRIGGERS.BACKUP_RECEIVED:
      Object.assign(data, {
        last_backup: iso(repository.lastBackupAt),
        summary: clip(t('summaryBackupReceived', language, values)),
      });
      break;
    case SCENE_TRIGGERS.BACKUP_RESUMED:
      Object.assign(data, {
        last_backup: iso(repository.lastBackupAt),
        summary: clip(t('summaryBackupResumed', language, values)),
      });
      break;
    case SCENE_TRIGGERS.BACKUP_OVERDUE: {
      const hours = repository.hoursSince;
      Object.assign(data, {
        hours_since_backup: numberOr(hours),
        threshold_hours: repository.staleAfterHours,
        last_backup: iso(repository.lastBackupAt),
        summary: clip(
          Number.isFinite(hours)
            ? t('summaryBackupOverdue', language, {
                ...values,
                since: duration(hours, language),
              })
            : t('summaryNeverBackedUp', language, values),
        ),
      });
      break;
    }
    case SCENE_TRIGGERS.QUOTA_LEVEL_REACHED:
      Object.assign(data, {
        scope: 'repository',
        level: String(event.level),
        used_percent: numberOr(repository.usedPercent),
        quota_gb: numberOr(repository.quotaGb),
        summary: clip(
          t('summaryQuotaRepository', language, {
            ...values,
            percent: repository.usedPercent,
            quota: repository.quotaGb,
          }),
        ),
      });
      break;
    default:
      break;
  }
  return { key: event.key, data };
}

/**
 * @description The event of an account transition (storage limit level).
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} account - The account snapshot.
 * @param {object} event - From diffAccount.
 * @param {string} language - Language of the summary.
 * @returns {{ key: string, data: object }} The event.
 */
function buildAccountEvent(gladys, account, event, language) {
  return {
    key: event.key,
    data: {
      repository: idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id).device,
      repository_name: clip(account.username || account.id),
      scope: 'account',
      usage_gb: numberOr(account.usageGb),
      level: String(event.level),
      used_percent: numberOr(account.usedPercent),
      quota_gb: numberOr(account.limitGb),
      summary: clip(
        t('summaryQuotaAccount', language, {
          percent: account.usedPercent,
          limit: account.limitGb,
        }),
      ),
    },
  };
}

export { buildRepositoryEvent, buildAccountEvent };
