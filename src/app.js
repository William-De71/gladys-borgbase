// -----------------------------------------------------------------------------
// The BorgBase integration: every handler, registered on a Gladys client.
//
// Watches the backup repositories of a BorgBase account (https://www.borgbase.com)
// and brings them into Gladys:
//   - a device per repository and one for the account (Discovery screen):
//     usage, quota used, time since the last backup, storage limit used,
//     overdue backups (device.js);
//   - scene triggers: backup received, backup overdue, backups resumed, quota
//     level reached (tracker.js, events.js);
//   - scene actions: read a repository, read the account (scene-actions.js);
//   - dashboard widgets: overview, repositories, usage history (widgets.js).
//
// BorgBase only alerts by e-mail, Pushover or webhook to a public address:
// the integration reads the GraphQL API on its own timer (borgbase-api.js)
// with an API token.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, readLanguage, INTERNAL_KEYS, AUTO_LANGUAGE } from './config.js';
import { createBorgBaseClient, buildUserAgent } from './borgbase-api.js';
import { createWatcher } from './watcher.js';
import {
  DEVICE_TYPES,
  idsOf,
  parseExternalId,
  buildRepositoryDevice,
  buildAccountDevice,
  buildRepositoryStates,
  buildAccountStates,
} from './device.js';
import { buildRepositoryEvent, buildAccountEvent } from './events.js';
import { SCENE_ACTIONS, buildRepositoryOutputs, buildAccountOutputs } from './scene-actions.js';
import {
  WIDGETS,
  messageContent,
  buildOverviewWidget,
  buildRepositoriesWidget,
  buildUsageWidget,
} from './widgets.js';
import { t, all, LANGUAGES } from './i18n.js';

const { name, version, homepage } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const ACTIONS = { TEST_CONNECTION: 'test_connection' };
// A scene action reuses the last round while it is this fresh.
const SNAPSHOT_MAX_AGE_MS = 60000;
// The longest status or Configuration screen message, per language.
const MAX_MESSAGE = 200;

/**
 * @description Join multi-language parts into one message, per language,
 * cut at MAX_MESSAGE characters.
 * @param {object[]} parts - Multi-language messages.
 * @returns {object} The message.
 */
function joinParts(parts) {
  return Object.fromEntries(
    LANGUAGES.map((lang) => {
      const text = parts.map((part) => part[lang]).join(' ');
      return [lang, text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE - 1)}…` : text];
    }),
  );
}

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetchImpl] - fetch implementation (tests).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ watcher: object, getConfig: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  { fetchImpl = globalThis.fetch, now = () => Date.now(), logger = sdkLogger } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`.
  let language = 'en';
  // Device external ids the user created (states are only published for them).
  let createdDevices = new Set();
  // Last connection status sent, to send it again only when it changes.
  let lastStatus = null;

  const borgbase = createBorgBaseClient({
    getToken: () => config.token,
    getUserAgent: () => buildUserAgent({ name, version, homepage }),
    fetch: fetchImpl,
    now,
  });

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  function textLanguage() {
    return config.language === AUTO_LANGUAGE ? language : config.language;
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The multi-language message of a failed read.
   * @param {Error} err - A BorgBaseError.
   * @returns {object} The message.
   */
  function errorMessage(err) {
    switch (err.kind) {
      case 'auth':
        return config.token ? all('statusInvalidToken') : all('noToken');
      case 'rate_limit':
        return all('statusRateLimited');
      case 'server':
      case 'invalid':
        return all('statusServer');
      default:
        return all('statusUnreachable');
    }
  }

  /**
   * @description The status of a successful round, in every language.
   * @param {object|null} account - The account.
   * @param {object[]} repositories - The repositories.
   * @param {string} key - `statusConnected` or `testOk`.
   * @returns {object} The message.
   */
  function roundMessage(account, repositories, key = 'statusConnected') {
    const parts = [
      all(key, {
        count: repositories.length,
        overdue: repositories.filter((repository) => repository.overdue).length,
      }),
    ];
    if (!account) {
      parts.push(all('statusNoAccount'));
    }
    return joinParts(parts);
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description Publish the states of the created devices. The SDK
   * remembers what it sent (publishChangedStates), and forgets a device when
   * the user creates it: its states then go out again in full.
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const repositoryStates = watcher
      .repositories()
      .filter((repository) =>
        createdDevices.has(idsOf(gladys, DEVICE_TYPES.REPOSITORY, repository.id).device),
      )
      .flatMap((repository) => buildRepositoryStates(gladys, repository));
    const account = watcher.account();
    const accountStates =
      account && createdDevices.has(idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id).device)
        ? buildAccountStates(gladys, account)
        : [];
    const states = [...accountStates, ...repositoryStates];
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  /**
   * @description Ask the dashboards to re-read the widgets.
   */
  function refreshWidgets() {
    Object.values(WIDGETS).forEach((key) => {
      try {
        gladys.requestWidgetRefresh(key);
      } catch (err) {
        logger.debug?.(`Widget refresh skipped: ${err.message}`);
      }
    });
  }

  /**
   * @description Publish a scene event, logging a refusal.
   * @param {{ key: string, data: object }} event - The event.
   * @returns {Promise<void>}
   */
  async function publishEvent({ key, data }) {
    logger.info(`${data.repository_name}: ${key}`);
    try {
      await gladys.publishSceneEvent(key, data);
    } catch (err) {
      logger.warn(`Unable to publish the scene event ${key}: ${err.message}`);
    }
  }

  // --- The watcher -----------------------------------------------------------------
  const watcher = createWatcher({
    borgbase,
    isEnabled: () => Boolean(config.token),
    getIntervalMs: () => config.pollInterval * 1000,
    getStaleHours: () => config.staleHours,
    onRound: async (round) => {
      for (const { repository, events } of round.repositories) {
        for (const event of events) {
          await publishEvent(buildRepositoryEvent(gladys, repository, event, textLanguage()));
        }
      }
      for (const event of round.accountEvents) {
        await publishEvent(buildAccountEvent(gladys, round.account, event, textLanguage()));
      }
      await publishStates().catch((err) =>
        logger.warn(`Unable to publish the states: ${err.message}`),
      );
      refreshWidgets();
      await reportStatus(true, roundMessage(round.account, watcher.repositories()));
    },
    onError: async (err) => {
      await reportStatus(false, errorMessage(err));
    },
    now,
    logger,
  });

  /**
   * @description Offer every repository and the account on the Discovery screen.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices() {
    const lang = textLanguage();
    const devices = [];
    if (config.token) {
      const account = watcher.account();
      if (account) {
        devices.push(buildAccountDevice(gladys, account, lang));
      }
      watcher
        .repositories()
        .forEach((repository) => devices.push(buildRepositoryDevice(gladys, repository, lang)));
    }
    await gladys.publishDiscoveredDevices(devices);
    return devices.length;
  }

  // --- Repositories of the widgets and scene actions -------------------------------

  /**
   * @description The repository a device select points to.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {object|null} The snapshot, null when none is chosen or known.
   */
  function chosenRepository(deviceExternalId) {
    const target = parseExternalId(deviceExternalId);
    if (!target || target.type !== DEVICE_TYPES.REPOSITORY) {
      return null;
    }
    return watcher.repositories().find((repository) => repository.id === target.id) ?? null;
  }

  /**
   * @description The content explaining why a widget has nothing to show, or null.
   * @param {string} lang - The user language.
   * @returns {object|null} The content.
   */
  function widgetBlocker(lang) {
    if (!config.token) {
      return messageContent(t('noToken', lang));
    }
    if (watcher.fetchedAt() === null) {
      return messageContent(t('notReadYet', lang), 60);
    }
    return null;
  }

  // --- Dashboard widgets -------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.OVERVIEW, async ({ language: lang }) => {
    rememberLanguage(lang);
    return (
      widgetBlocker(lang) ??
      buildOverviewWidget({
        account: watcher.account(),
        repositories: watcher.repositories(),
        language: lang,
        now: now(),
        pollSeconds: config.pollInterval,
      })
    );
  });

  gladys.onWidgetGet(WIDGETS.REPOSITORIES, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    return (
      widgetBlocker(lang) ??
      buildRepositoriesWidget({
        repositories: watcher.repositories(),
        language: lang,
        settings,
        now: now(),
        pollSeconds: config.pollInterval,
      })
    );
  });

  gladys.onWidgetGet(WIDGETS.USAGE, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const blocker = widgetBlocker(lang);
    if (blocker) {
      return blocker;
    }
    const account = watcher.account();
    // No repository chosen: the account total, or the largest repository when
    // the token cannot read the account.
    const repository =
      chosenRepository(settings.repository) ??
      (account
        ? null
        : ([...watcher.repositories()].sort((a, b) => (b.usageGb ?? 0) - (a.usageGb ?? 0))[0] ??
          null));
    const device = repository
      ? idsOf(gladys, DEVICE_TYPES.REPOSITORY, repository.id).device
      : account
        ? idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id).device
        : null;
    return buildUsageWidget({
      gladys,
      repository,
      account,
      language: lang,
      settings,
      created: device !== null && createdDevices.has(device),
      pollSeconds: config.pollInterval,
    });
  });

  // --- Scene actions -----------------------------------------------------------------

  /**
   * @description Make sure the snapshots are fresh enough for a scene action.
   * @returns {Promise<void>}
   * @throws {Error} When nothing is configured or BorgBase cannot be read.
   */
  async function freshSnapshots() {
    if (!config.token) {
      throw new Error('BorgBase is not configured (API token)');
    }
    if (!(await watcher.fresh(SNAPSHOT_MAX_AGE_MS))) {
      throw new Error('BorgBase could not be read');
    }
  }

  gladys.onSceneAction(SCENE_ACTIONS.GET_REPOSITORY, async (fields) => {
    await freshSnapshots();
    const repository = chosenRepository(fields.repository) ?? watcher.repositories()[0];
    if (!repository) {
      throw new Error('No repository on this BorgBase account');
    }
    return buildRepositoryOutputs(repository, textLanguage());
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_ACCOUNT, async () => {
    await freshSnapshots();
    return buildAccountOutputs(watcher.account(), watcher.repositories(), textLanguage());
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    if (!config.token) {
      return all('noToken');
    }
    try {
      await borgbase.round();
    } catch (err) {
      return errorMessage(err);
    }
    // The answer is read again by a full round, so the snapshots and the
    // Discovery screen follow the token that was just checked.
    await watcher.round();
    await publishDiscoveredDevices().catch(() => {});
    return roundMessage(watcher.account(), watcher.repositories(), 'testOk');
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await watcher.round();
    const count = await publishDiscoveredDevices();
    logger.info(`Scan: ${count} BorgBase device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishStates().catch((err) =>
      logger.warn(`Unable to publish the states: ${err.message}`),
    );
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  /**
   * @description Read BorgBase now and offer the devices; report a missing token.
   * @returns {Promise<void>}
   */
  async function refreshAll() {
    if (!config.token) {
      await reportStatus(false, all('noToken'));
    }
    await watcher.round();
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const previous = `${config.token}|${config.staleHours}`;
    await loadConfig(rawConfig);
    logger.info(
      `Configuration updated: ${config.token ? 'token set' : 'no token'}, overdue after ${
        config.staleHours
      } h, read every ${config.pollInterval} s`,
    );
    if (`${config.token}|${config.staleHours}` !== previous) {
      // Another account, or another threshold: start from a fresh baseline so
      // that no scene fires for a change the user made.
      watcher.reset();
    }
    watcher.reschedule();
    await refreshAll();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each step on its own: a failing one must not keep the watcher from starting.
  gladys.on('connected', async () => {
    await loadConfig();
    await refreshCreatedDevices();
    lastStatus = null;
    await refreshAll();
    watcher.start();
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    watcher.stop();
  });

  return { watcher, getConfig: () => config };
}

export { createApp };
