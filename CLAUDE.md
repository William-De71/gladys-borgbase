# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for BorgBase (offsite hosting of
BorgBackup and restic repositories): a Node.js service (Node 22+, ESM, no
build step) that runs in its own sandboxed Docker container and talks to
Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the official BorgBase GraphQL API
(https://api.borgbase.com/graphql, doc https://docs.borgbase.com/api/) with an
API token in a Bearer header: one query per round (`me` + `repoList`), every
900 s by default. It never writes (no mutation): a Read Only token is enough.
Never tested with a real account: the shapes come from the live schema
(introspection is open without a token), the web interface bundle and the
official Python client, read on 2026-11-25.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(): statuses,
                        discovery, states, widgets, scene actions, test button
src/borgbase-api.js     GraphQL client: the round query, Bearer token, error
                        kinds (UNAUTHENTICATED on a 200), Retry-After / 429
src/read.js             answers -> snapshots: MB -> GB, quota share and level,
                        hours since the last write, overdue threshold
src/watcher.js          the timer loop, snapshots, transitions per round
src/tracker.js          snapshots -> scene trigger transitions (pure logic)
src/events.js           scene trigger payloads
src/device.js           one device per repository + one for the account
src/scene-actions.js    get_repository and get_account outputs
src/widgets.js          overview, repositories, usage
src/config.js           configuration (token, stale_hours, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/helpers/fixtures.js  a fake GraphQL endpoint behind the `fetch` option
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## BorgBase facts the code relies on

- A refused or missing token answers **HTTP 200** with
  `errors[].extensions.code = "UNAUTHENTICATED"` and null data: only an error
  on `repoList` decides the round. An error on `me` alone (a token that cannot
  read the account) leaves the account null: no account device, the status
  says so.
- `currentUsage`, `quota`, `diskUsage` and `storageLimitMb` are **decimal
  megabytes** (the web interface divides by 1e3 for GB); plan sizes are GB.
  `quota` only counts when `quotaEnabled`.
- `lastModified` is the last write (the "Modified" column): a backup, but also
  a prune or a compaction. It is null for a repository never written to.
- `alertDays` is the per-repository BorgBase monitoring (0 = off). When on, it
  is the overdue threshold; otherwise `stale_hours`.
- `repoEventList` exists (access log per repository) but its `slug` values are
  not documented: not used.
- No documented rate limit; 429 + Retry-After are honored anyway.

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`repo:<8-character id>`, `account:<id>`, never a
  name), feature `category` / `type` / `unit` / `min` / `max` / `step`, the
  keys of `config_schema`, `actions`, widgets and their settings, scene
  triggers (fields, options, variables) and scene actions (fields, outputs).
  `test/structure.test.js` compares them to `test/fixtures/discovery.baseline.json`:
  never update the baseline to make a test pass without a documented migration.
- **`should_poll` stays false**: BorgBase is read on the integration's own
  timer (300 to 3600 s). It never resyncs on existing devices.
- **Unknown is left out, never 0**: no quota, never backed up, account not
  readable: the state is not published, an output is -1.
- **The first round is a baseline**: no scene event replays history after a
  restart. A new token or a new `stale_hours` resets the baseline, so a change
  the user made never fires a scene. A repository seen for the first time is a
  baseline too.
- **Never fire a scene event from a scene action.** The actions only read.
- **Read only.** Never add a mutation (repoCompact, repoEdit…) without asking:
  the docs tell users a Read Only token is enough.
- **Be gentle with BorgBase**: one query per interval; widgets read the
  snapshots, actions re-read only when the last round is older than 60 s.
- **The container rootfs is read-only.** Write only under `/data` (nothing is
  stored today). Never log the token; it only goes to api.borgbase.com.
- **Card lists**: the front shows `subtitle` (60 characters) and a `date`
  would replace it: the relative time goes in the subtitle, never `date`.
- **The usage chart** is device-bound (`device_features` + `interval`): Gladys
  draws the history it keeps. The illustration (gen.mjs) swaps it for an
  inline made-up series, since it has no database.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. French says "vous", German "du",
  Spanish "usted". Sizes are Go / To / Mo in French. Status messages are cut
  at 200 characters.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language. A field older cores
  do not know needs a higher `gladys_version` minimum (see `src/constants.js`
  of the integration-store). Transport: `["cloud"]`. The BorgBase mark names
  the service only; keep the "not affiliated" notices.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.

## Pitfalls

- `node --test` also runs `test/helpers/`: nothing starts on import.
- The level filter of `quota_level_reached` compares strings: the event
  carries `"80"`, `"90"`, `"100"`, the option values.
