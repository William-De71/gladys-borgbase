// -----------------------------------------------------------------------------
// BorgBase answers -> plain snapshots.
//
// Sizes become decimal gigabytes (BorgBase counts in decimal megabytes), dates
// become milliseconds. A value BorgBase does not give stays null, never 0:
// the device state is then not published.
//
// The staleness of a repository ("no new backup for too long") is computed
// here, against a threshold:
//   - the repository's own BorgBase monitoring (`alertDays` > 0), in days;
//   - else the `stale_hours` setting of the integration.
// A repository never written to counts from its creation.
// -----------------------------------------------------------------------------

const MEGABYTES_PER_GIGABYTE = 1000;
const HOUR_MS = 3600000;
// Quota levels a scene can wait for, in % of the quota (or of the storage
// limit of the account).
const QUOTA_LEVELS = [80, 90, 100];

const round2 = (value) => Math.round(value * 100) / 100;
const round1 = (value) => Math.round(value * 10) / 10;

/**
 * @description A finite number, or null.
 * @param {unknown} value - The raw value.
 * @returns {number|null} The number.
 */
function num(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * @description A date in ms, or null.
 * @param {unknown} value - An ISO 8601 date.
 * @returns {number|null} The instant.
 */
function instant(value) {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/**
 * @description Decimal megabytes -> decimal gigabytes, 2 decimals.
 * @param {unknown} megabytes - The size.
 * @returns {number|null} The size in GB.
 */
function gigabytes(megabytes) {
  const value = num(megabytes);
  return value === null || value < 0 ? null : round2(value / MEGABYTES_PER_GIGABYTE);
}

/**
 * @description A share in %, 1 decimal, or null without a positive total.
 * @param {number|null} used - The used size.
 * @param {number|null} total - The total.
 * @returns {number|null} The share.
 */
function percent(used, total) {
  if (used === null || total === null || total <= 0) {
    return null;
  }
  return round1((used / total) * 100);
}

/**
 * @description The highest QUOTA_LEVELS value a share has reached, 0 below all.
 * @param {number|null} share - The share in %.
 * @returns {number} The level.
 * @example
 * quotaLevel(93.2); // -> 90
 */
function quotaLevel(share) {
  if (share === null) {
    return 0;
  }
  return QUOTA_LEVELS.filter((level) => share >= level).pop() ?? 0;
}

/**
 * @description The repository id, as BorgBase gives it (8 letters and digits).
 * @param {unknown} id - The raw id.
 * @returns {string|null} The id, lowercase.
 */
function repositoryId(id) {
  const text = String(id ?? '').toLowerCase();
  return /^[a-z0-9]{1,32}$/.test(text) ? text : null;
}

/**
 * @description The account snapshot.
 * @param {object|null} raw - The `me` answer.
 * @returns {object|null} The account, null when unknown.
 * @example
 * readAccount({ id: '42', username: 'ada@example.com', diskUsage: 1200, storageLimitMb: 1000000 });
 */
function readAccount(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const id = String(raw.id ?? '');
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    return null;
  }
  const usageGb = gigabytes(raw.diskUsage);
  const limitMb = num(raw.storageLimitMb);
  const limitGb = limitMb !== null && limitMb > 0 ? gigabytes(limitMb) : null;
  const plan = raw.activePlan && typeof raw.activePlan === 'object' ? raw.activePlan : null;
  const overage =
    raw.outstandingOverage && typeof raw.outstandingOverage === 'object'
      ? {
          amount: num(raw.outstandingOverage.amount),
          dueAt: instant(raw.outstandingOverage.dueDate),
          overdue: raw.outstandingOverage.overdue === true,
        }
      : null;
  const usedPercent = percent(usageGb, limitGb);
  return {
    id,
    username: typeof raw.username === 'string' ? raw.username : '',
    plan: plan && typeof plan.name === 'string' ? plan.name : null,
    includedGb: num(plan?.includedGb),
    maxSizeGb: num(plan?.maxSizeGb),
    usageGb,
    limitGb,
    usedPercent,
    level: quotaLevel(usedPercent),
    repoCount: Number.isInteger(raw.repoCount) ? raw.repoCount : null,
    overage,
  };
}

/**
 * @description The staleness threshold of a repository, in hours.
 * @param {number|null} alertDays - The BorgBase monitoring of the repository.
 * @param {number} staleHours - The setting of the integration.
 * @returns {{ hours: number, source: string }} The threshold and where it
 * comes from (`borgbase` or `setting`).
 */
function thresholdOf(alertDays, staleHours) {
  if (alertDays !== null && alertDays > 0) {
    return { hours: alertDays * 24, source: 'borgbase' };
  }
  return { hours: staleHours, source: 'setting' };
}

/**
 * @description The repository snapshot.
 * @param {object} raw - One entry of `repoList`.
 * @param {object} context - `{ now, staleHours }`.
 * @returns {object|null} The repository, null without a valid id.
 * @example
 * readRepository({ id: 'y4ab823u', name: 'nas', currentUsage: 12345, … }, { now: Date.now(), staleHours: 26 });
 */
function readRepository(raw, { now, staleHours }) {
  const id = repositoryId(raw?.id);
  if (!id) {
    return null;
  }
  const usageGb = gigabytes(raw.currentUsage);
  const quotaMb = num(raw.quota);
  const quotaGb =
    raw.quotaEnabled === true && quotaMb !== null && quotaMb > 0 ? gigabytes(quotaMb) : null;
  const usedPercent = percent(usageGb, quotaGb);
  const lastBackupAt = instant(raw.lastModified);
  const createdAt = instant(raw.createdAt);
  const alertDays = num(raw.alertDays);
  const threshold = thresholdOf(alertDays, staleHours);
  const since = lastBackupAt ?? createdAt;
  const hoursSince = since === null ? null : Math.max(0, round1((now - since) / HOUR_MS));
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id,
    region: typeof raw.region === 'string' ? raw.region : '',
    format: typeof raw.format === 'string' ? raw.format : '',
    location: typeof raw.server?.location === 'string' ? raw.server.location : '',
    appendOnly: raw.appendOnly === true,
    usageGb,
    quotaGb,
    usedPercent,
    level: quotaLevel(usedPercent),
    lastBackupAt,
    createdAt,
    // Hours since the last write (or since the creation, never written).
    hoursSince: lastBackupAt === null ? null : hoursSince,
    alertDays,
    staleAfterHours: threshold.hours,
    thresholdSource: threshold.source,
    overdue: hoursSince !== null && hoursSince >= threshold.hours,
  };
}

/**
 * @description Every snapshot of a round.
 * @param {{ account: object|null, repositories: object[] }} answer - From the client.
 * @param {object} context - `{ now, staleHours }`.
 * @returns {{ account: object|null, repositories: object[] }} The snapshots,
 * repositories sorted by name.
 */
function readRound(answer, context) {
  const seen = new Set();
  const repositories = [];
  for (const raw of answer?.repositories ?? []) {
    const repository = readRepository(raw, context);
    if (repository && !seen.has(repository.id)) {
      seen.add(repository.id);
      repositories.push(repository);
    }
  }
  repositories.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const account = readAccount(answer?.account);
  if (account) {
    account.overdueCount = repositories.filter((repository) => repository.overdue).length;
    // The list is what the integration shows: its length, not `repoCount`.
    account.repositoryTotal = repositories.length;
  }
  return { account, repositories };
}

export {
  QUOTA_LEVELS,
  HOUR_MS,
  gigabytes,
  percent,
  quotaLevel,
  thresholdOf,
  readAccount,
  readRepository,
  readRound,
};
