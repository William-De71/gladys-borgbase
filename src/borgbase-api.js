// -----------------------------------------------------------------------------
// Client of the BorgBase GraphQL API (https://api.borgbase.com/graphql).
//
// BorgBase documents its API at https://docs.borgbase.com/api/ and publishes
// the schema by introspection (open without a token). The integration only
// reads: one query per round asks for the account (`me`) and every
// repository (`repoList`). A "Read Only" API token is enough.
//
// Facts checked on 2026-11-25 against the live schema, the web interface and
// the official Python client (borgbase/borgbase-api-client):
//   - the token goes in `Authorization: Bearer <token>`;
//   - a refused or missing token still answers HTTP 200, with
//     `errors[].extensions.code = "UNAUTHENTICATED"` and null data;
//   - `currentUsage` and `quota` are decimal megabytes (the web interface
//     shows `quota / 1e3` GB), `storageLimitMb` and `diskUsage` of the
//     account too, the plan sizes are decimal gigabytes;
//   - `lastModified` is the last write to the repository (the "Modified"
//     column of the web interface): a new backup, a prune, a compaction;
//   - `alertDays` is the per-repository monitoring of BorgBase ("send an
//     alert after X days without a new backup"), 0 when off.
//
// Error kinds (BorgBaseError.kind), each mapped to a status message by app.js:
//   - `auth`        the token is refused (UNAUTHENTICATED, HTTP 401 / 403);
//   - `rate_limit`  HTTP 429 (Retry-After honored);
//   - `server`      HTTP 5xx, or a GraphQL error on the repository list;
//   - `network`     no answer (DNS, timeout, connection reset);
//   - `invalid`     an answer that is not the expected JSON.
// -----------------------------------------------------------------------------

const ENDPOINT = 'https://api.borgbase.com/graphql';
const TIMEOUT_MS = 30000;

// The fields the integration reads. Nothing else: no SSH key, no htpasswd,
// no billing address.
const ROUND_QUERY = `query GladysRound {
  me {
    id
    username
    repoCount
    diskUsage
    storageLimitMb
    activePlan { name includedGb maxSizeGb }
    outstandingOverage { amount dueDate overdue }
  }
  repoList {
    id
    name
    region
    format
    quota
    quotaEnabled
    currentUsage
    lastModified
    createdAt
    alertDays
    appendOnly
    server { hostname location }
  }
}`;

class BorgBaseError extends Error {
  /**
   * @param {string} kind - auth | rate_limit | server | network | invalid.
   * @param {string} message - The message (never the token).
   * @param {object} [extra] - `{ status, resetAt }`.
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'BorgBaseError';
    this.kind = kind;
    this.status = extra.status ?? 0;
    this.resetAt = extra.resetAt ?? null;
  }
}

/**
 * @description Read a Retry-After header in seconds (a number or an HTTP date).
 * @param {Headers} headers - The headers.
 * @param {number} now - Now, in ms.
 * @returns {number|null} When to retry, in ms, or null.
 */
function retryAt(headers, now) {
  const raw = headers?.get?.('retry-after');
  if (!raw) {
    return null;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return now + seconds * 1000;
  }
  const date = Date.parse(raw);
  return Number.isFinite(date) ? date : null;
}

/**
 * @description Whether a GraphQL error says the token is refused.
 * @param {object} error - One entry of `errors`.
 * @returns {boolean} True when it does.
 */
function isAuthError(error) {
  const code = error?.extensions?.code;
  return code === 'UNAUTHENTICATED' || /not authenticated/i.test(String(error?.message ?? ''));
}

/**
 * @description Create the BorgBase client.
 * @param {object} options - Options.
 * @param {Function} options.getToken - `() => string`.
 * @param {Function} options.getUserAgent - `() => string`.
 * @param {Function} [options.fetch] - fetch implementation (tests).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @returns {{ round: Function, throttledUntil: Function }} The client.
 * @example
 * const borgbase = createBorgBaseClient({ getToken: () => token, getUserAgent: () => 'x' });
 * const { account, repositories } = await borgbase.round();
 */
function createBorgBaseClient({
  getToken,
  getUserAgent,
  fetch = globalThis.fetch,
  now = Date.now,
}) {
  let throttledUntil = null;

  /**
   * @description Send one GraphQL query.
   * @param {string} query - The query.
   * @returns {Promise<object>} The parsed answer `{ data, errors }`.
   * @throws {BorgBaseError} On a refused token, an HTTP error or no answer.
   */
  async function send(query) {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
          'User-Agent': getUserAgent(),
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new BorgBaseError('network', `BorgBase unreachable: ${err.cause?.code ?? err.name}`);
    }
    const status = response.status;
    if (status === 429) {
      const resetAt = retryAt(response.headers, now());
      throttledUntil = resetAt;
      throw new BorgBaseError('rate_limit', 'BorgBase asks to slow down (429)', {
        status,
        resetAt,
      });
    }
    if (status === 401 || status === 403) {
      throw new BorgBaseError('auth', `BorgBase refused the token (${status})`, { status });
    }
    if (status >= 500) {
      throw new BorgBaseError('server', `BorgBase answered ${status}`, { status });
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new BorgBaseError('invalid', `BorgBase answered ${status} without JSON`, { status });
    }
    if (!body || typeof body !== 'object') {
      throw new BorgBaseError('invalid', 'Unexpected BorgBase answer', { status });
    }
    if (status !== 200 && !body.data) {
      throw new BorgBaseError('server', `BorgBase answered ${status}`, { status });
    }
    return body;
  }

  return {
    /**
     * @description Read the account and every repository.
     * @returns {Promise<{ account: object|null, repositories: object[] }>} The raw
     * answers: the account is null when the token cannot read it.
     * @throws {BorgBaseError} When the repositories cannot be read.
     */
    async round() {
      const { data, errors = [] } = await send(ROUND_QUERY);
      const errorOf = (field) =>
        (Array.isArray(errors) ? errors : []).find((error) => error?.path?.[0] === field);
      const repoError = errorOf('repoList');
      if (repoError && isAuthError(repoError)) {
        throw new BorgBaseError('auth', 'BorgBase refused the token (UNAUTHENTICATED)');
      }
      if (repoError) {
        throw new BorgBaseError(
          'server',
          `BorgBase error: ${String(repoError.message).slice(0, 200)}`,
        );
      }
      if (!Array.isArray(data?.repoList)) {
        throw new BorgBaseError('invalid', 'BorgBase returned no repository list');
      }
      throttledUntil = null;
      return {
        account: data.me && typeof data.me === 'object' ? data.me : null,
        repositories: data.repoList.filter((repo) => repo && typeof repo === 'object'),
      };
    },
    /** @returns {number|null} Until when BorgBase asked to wait, in ms. */
    throttledUntil: () => (throttledUntil && throttledUntil > now() ? throttledUntil : null),
  };
}

/**
 * @description The User-Agent of the integration.
 * @param {{ name: string, version: string, homepage: string }} pkg - package.json fields.
 * @returns {string} The User-Agent.
 * @example
 * buildUserAgent({ name: 'gladys-borgbase', version: '0.1.0', homepage: 'https://…' });
 */
function buildUserAgent({ name, version, homepage }) {
  return `${name}/${version} (+${homepage})`;
}

export { ENDPOINT, ROUND_QUERY, BorgBaseError, createBorgBaseClient, buildUserAgent, isAuthError };
