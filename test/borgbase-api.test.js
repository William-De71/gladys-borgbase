import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createBorgBaseClient, buildUserAgent, ENDPOINT } from '../src/borgbase-api.js';
import { borgbaseApi, defaultState, response, TEST_TOKEN, NOW } from './helpers/fixtures.js';

const client = (fetch, token = TEST_TOKEN) =>
  createBorgBaseClient({
    getToken: () => token,
    getUserAgent: () => 'gladys-borgbase/0.1.0 (+https://example.org)',
    fetch,
    now: () => NOW,
  });

test('one POST with the Bearer token reads the account and every repository', async () => {
  const fetch = borgbaseApi(defaultState);
  const answer = await client(fetch).round();
  assert.equal(fetch.calls.length, 1);
  const [call] = fetch.calls;
  assert.equal(call.url, ENDPOINT);
  assert.equal(call.method, 'POST');
  assert.equal(call.headers.Authorization, `Bearer ${TEST_TOKEN}`);
  assert.match(call.headers['User-Agent'], /^gladys-borgbase\//);
  assert.match(call.body.query, /repoList/);
  assert.doesNotMatch(call.body.query, /htpasswd|fullAccessKeys|street|vykarToken/);
  assert.equal(answer.account.username, 'ada@example.com');
  assert.equal(answer.repositories.length, 3);
});

test('a refused token answers 200 with UNAUTHENTICATED: an auth error', async () => {
  await assert.rejects(client(borgbaseApi(defaultState), 'wrong').round(), { kind: 'auth' });
});

test('an account the token cannot read is null, the repositories still come', async () => {
  const answer = await client(borgbaseApi(() => ({ ...defaultState(), meError: true }))).round();
  assert.equal(answer.account, null);
  assert.equal(answer.repositories.length, 3);
});

test('HTTP and GraphQL errors get their kind; 429 remembers Retry-After', async () => {
  const cases = [
    [[401, { message: 'no' }], 'auth'],
    [[500, undefined], 'server'],
    [[200, undefined], 'invalid'],
    [
      [200, { data: { repoList: null }, errors: [{ message: 'boom', path: ['repoList'] }] }],
      'server',
    ],
    [[200, { data: {} }], 'invalid'],
  ];
  for (const [fail, kind] of cases) {
    await assert.rejects(client(borgbaseApi(defaultState, { fail })).round(), { kind });
  }
  const limited = client(borgbaseApi(defaultState, { fail: [429, {}, { 'Retry-After': '120' }] }));
  await assert.rejects(limited.round(), { kind: 'rate_limit', resetAt: NOW + 120000 });
  assert.equal(limited.throttledUntil(), NOW + 120000);
});

test('no answer at all is a network error, without the token in the message', async () => {
  const fetch = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  };
  await assert.rejects(client(fetch).round(), (err) => {
    assert.equal(err.kind, 'network');
    assert.doesNotMatch(err.message, new RegExp(TEST_TOKEN));
    return true;
  });
  assert.ok(response(200, {}).ok);
});

test('the User-Agent names the integration and its page', () => {
  assert.equal(
    buildUserAgent({ name: 'gladys-borgbase', version: '0.1.0', homepage: 'https://x.y' }),
    'gladys-borgbase/0.1.0 (+https://x.y)',
  );
});
