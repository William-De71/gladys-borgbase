// Shapes of the BorgBase GraphQL answers (live schema and answers of
// 2026-11-25: a refused token still answers 200 with UNAUTHENTICATED errors),
// a fake BorgBase behind `fetch`, and a stand-in for the SDK external ids.
// Tests never touch the network.

export const NOW = Date.parse('2026-11-25T10:00:00Z');
export const ACCOUNT_ID = '48213';
export const NAS_ID = 'y4ab823u';
export const LAPTOP_ID = 'k9qz21mx';
export const PHOTOS_ID = 'p3rt77wd';
export const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.test.token';
const HOUR = 3600000;
const iso = (ms) => new Date(ms).toISOString();

/**
 * @description A repository, as `repoList` answers it (sizes in decimal MB).
 * @param {object} [options] - Overrides.
 * @returns {object} The raw repository.
 */
export function rawRepository({
  id = NAS_ID,
  name = 'nas',
  usageMb = 412345.6,
  quotaMb = 500000,
  quotaEnabled = true,
  lastModified = NOW - 3 * HOUR,
  created = NOW - 400 * 24 * HOUR,
  alertDays = 0,
  region = 'eu',
  appendOnly = true,
} = {}) {
  return {
    id,
    name,
    region,
    format: 'borg1',
    quota: quotaMb,
    quotaEnabled,
    currentUsage: usageMb,
    lastModified: lastModified === null ? null : iso(lastModified),
    createdAt: iso(created),
    alertDays,
    appendOnly,
    server: { hostname: `${id}.repo.borgbase.com`, location: 'Helsinki, Finland' },
  };
}

/**
 * @description The account, as `me` answers it.
 * @param {object} [options] - Overrides.
 * @returns {object} The raw account.
 */
export function rawAccount({ diskUsageMb = 812000, limitMb = 1000000, overdue = false } = {}) {
  return {
    id: ACCOUNT_ID,
    username: 'ada@example.com',
    repoCount: 3,
    diskUsage: diskUsageMb,
    storageLimitMb: limitMb,
    activePlan: { name: 'Medium', includedGb: 1000, maxSizeGb: 2000 },
    outstandingOverage: overdue
      ? { amount: 4.2, dueDate: iso(NOW - 24 * HOUR), overdue: true }
      : null,
  };
}

/**
 * @description The default account: three repositories, one overdue (laptop,
 * monitoring of 2 days, last write 5 days ago), one never written.
 * @returns {{ account: object, repositories: object[] }} The state.
 */
export function defaultState() {
  return {
    account: rawAccount(),
    repositories: [
      rawRepository(),
      rawRepository({
        id: LAPTOP_ID,
        name: 'laptop',
        usageMb: 98000,
        quotaEnabled: false,
        quotaMb: 0,
        lastModified: NOW - 5 * 24 * HOUR,
        alertDays: 2,
      }),
      rawRepository({
        id: PHOTOS_ID,
        name: 'photos',
        usageMb: 0,
        quotaEnabled: false,
        lastModified: null,
        created: NOW - 2 * HOUR,
        appendOnly: false,
      }),
    ],
  };
}

/**
 * @description A fetch Response stand-in.
 * @param {number} status - The HTTP status.
 * @param {unknown} body - The JSON body (undefined: not JSON).
 * @param {object} [headers] - The headers.
 * @returns {object} The response.
 */
export function response(status, body, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) =>
        lower[name.toLowerCase()] === undefined ? null : String(lower[name.toLowerCase()]),
    },
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('no JSON');
      }
      return JSON.parse(JSON.stringify(body));
    },
  };
}

const unauthenticated = (field, line) => ({
  message: 'Not authenticated.',
  locations: [{ line, column: 3 }],
  path: [field],
  extensions: { code: 'UNAUTHENTICATED' },
});

/**
 * @description A fake BorgBase GraphQL endpoint.
 * @param {Function} getState - `() => ({ account, repositories, meError })`.
 * @param {object} [options] - `{ fail }`: `[status, body?, headers?]` answered instead.
 * @returns {Function} The fetch, with `calls`.
 */
export function borgbaseApi(getState, { fail = null } = {}) {
  const api = async (url, init = {}) => {
    const call = {
      url,
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    api.calls.push(call);
    if (url !== 'https://api.borgbase.com/graphql' || call.method !== 'POST') {
      return response(404, undefined);
    }
    if (fail) {
      const [status, body, headers] = fail;
      return response(status, body, headers);
    }
    if (call.headers.Authorization !== `Bearer ${TEST_TOKEN}`) {
      return response(200, {
        data: { me: null, repoList: null },
        errors: [unauthenticated('me', 2), unauthenticated('repoList', 11)],
      });
    }
    const state = getState();
    if (state.meError) {
      return response(200, {
        data: { me: null, repoList: state.repositories },
        errors: [{ message: 'Permission denied.', path: ['me'] }],
      });
    }
    return response(200, { data: { me: state.account, repoList: state.repositories } });
  };
  api.calls = [];
  return api;
}

export const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:borgbase:${type}:${id}`,
    feature: (key) => `ext:borgbase:${type}:${id}:${key}`,
  }),
};

export const silent = { debug() {}, info() {}, warn() {}, error() {} };
