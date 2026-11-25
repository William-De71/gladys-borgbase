// -----------------------------------------------------------------------------
// The watcher: reads BorgBase on a loop.
//
// Each round is one GraphQL query (the account and every repository, see
// borgbase-api.js). It leaves a snapshot of the account and of each
// repository, the single source the devices, the widgets and the scene
// actions read from, and the transitions since the previous round (see
// tracker.js).
//
// The loop is a chain of timeouts, not an interval: a slow round never
// overlaps the next one, and a new interval takes effect at once. When
// BorgBase asks to slow down (429, Retry-After), the next round waits.
// -----------------------------------------------------------------------------

import { readRound } from './read.js';
import { diffRepository, diffAccount } from './tracker.js';

/**
 * @description Create the watcher.
 * @param {object} options - Options.
 * @param {object} options.borgbase - The BorgBase client.
 * @param {Function} options.isEnabled - `() => boolean` (a token is set).
 * @param {Function} options.getIntervalMs - `() => number`.
 * @param {Function} options.getStaleHours - `() => number`.
 * @param {Function} [options.onRound] - `(round)` after every successful read.
 * @param {Function} [options.onError] - `(error)` after every failed read.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} The watcher.
 * @example
 * const watcher = createWatcher({ borgbase, isEnabled: () => true, … });
 */
function createWatcher({
  borgbase,
  isEnabled,
  getIntervalMs,
  getStaleHours,
  onRound = () => {},
  onError = () => {},
  now = () => Date.now(),
  logger = console,
}) {
  let repositories = new Map();
  let account = null;
  let fetchedAt = null;
  let timer = null;
  let running = false;
  let inFlight = null;
  let retryAt = null;

  /**
   * @description Read BorgBase once, update the snapshots, report the round.
   * @returns {Promise<object>} The round.
   * @throws {Error} When the read fails (after onError).
   */
  async function read() {
    let answer;
    try {
      answer = await borgbase.round();
    } catch (err) {
      if (err.kind === 'rate_limit' && Number.isFinite(err.resetAt)) {
        retryAt = err.resetAt;
      }
      await onError(err);
      throw err;
    }
    retryAt = null;
    const time = now();
    const snapshots = readRound(answer, { now: time, staleHours: getStaleHours() });
    const baseline = fetchedAt === null;
    const next = new Map();
    const entries = [];
    for (const repository of snapshots.repositories) {
      const previous = repositories.get(repository.id) ?? null;
      next.set(repository.id, repository);
      entries.push({
        repository,
        events: baseline ? [] : diffRepository(previous, repository),
      });
    }
    const accountEvents = baseline ? [] : diffAccount(account, snapshots.account);
    repositories = next;
    account = snapshots.account;
    fetchedAt = time;
    const round = { repositories: entries, account, accountEvents };
    await onRound(round);
    return round;
  }

  /**
   * @description One round now, shared with a round already running.
   * @returns {Promise<object|null>} The round, null when disabled or failed.
   */
  function round() {
    if (!isEnabled()) {
      return Promise.resolve(null);
    }
    if (!inFlight) {
      inFlight = read()
        .catch((err) => {
          logger.warn(`BorgBase read failed: ${err.message}`);
          return null;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  }

  /**
   * @description Delay before the next round.
   * @returns {number} In ms.
   */
  function nextDelay() {
    const interval = getIntervalMs();
    const until = Math.max(retryAt ?? 0, borgbase.throttledUntil?.() ?? 0);
    if (until > now()) {
      return Math.max(interval, until - now() + 5000);
    }
    return interval;
  }

  /**
   * @description Schedule the next round.
   */
  function schedule() {
    clearTimeout(timer);
    if (!running) {
      return;
    }
    timer = setTimeout(async () => {
      await round();
      schedule();
    }, nextDelay());
    timer.unref?.();
  }

  return {
    /** Start the loop: one round per interval (the caller reads once first). */
    start() {
      if (running) {
        return;
      }
      running = true;
      schedule();
    },
    /** Stop the loop. */
    stop() {
      running = false;
      clearTimeout(timer);
    },
    /** Apply a new interval at once. */
    reschedule() {
      schedule();
    },
    round,
    nextDelay,
    /**
     * @description Fresh enough snapshots, read now otherwise.
     * @param {number} maxAgeMs - Accepted age.
     * @returns {Promise<boolean>} Whether snapshots exist.
     */
    async fresh(maxAgeMs) {
      if (fetchedAt === null || now() - fetchedAt > maxAgeMs) {
        await round();
      }
      return fetchedAt !== null;
    },
    /** @returns {object[]} The repositories of the last round, by name. */
    repositories: () => [...repositories.values()],
    /** @returns {object|null} The account of the last round. */
    account: () => account,
    /** @returns {number|null} When BorgBase was last read, in ms. */
    fetchedAt: () => fetchedAt,
    /** Forget everything (new token or threshold: start from a new baseline). */
    reset() {
      repositories = new Map();
      account = null;
      fetchedAt = null;
    },
  };
}

export { createWatcher };
