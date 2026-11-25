// -----------------------------------------------------------------------------
// Configuration of the BorgBase integration.
//
// Fields of the config_schema:
//   - `token`          a BorgBase API token ("Read Only" is enough);
//   - `stale_hours`    after how many hours without a new backup a
//                      repository is overdue, when its own BorgBase
//                      monitoring is off;
//   - `poll_interval`  how often BorgBase is read, in seconds;
//   - `language`       language of the texts Gladys does not ask for in a
//                      language (device names, scene summaries): `auto`
//                      follows the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`  language of the last widget request, for the device
//                      names and the scene texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const POLL_INTERVAL = { min: 300, max: 3600, default: 900 };
const STALE_HOURS = { min: 1, max: 2160, default: 26 };
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };

/**
 * @description Read a bounded number field, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('600', POLL_INTERVAL); // -> 600
 */
function readNumber(raw, bounds) {
  const value = Number(raw ?? bounds.default);
  if (raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Read the token: a pasted one may carry spaces or new lines,
 * or a leading "Bearer ".
 * @param {unknown} raw - The raw field.
 * @returns {string} The token.
 */
function readToken(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.replace(/^\s*bearer\s+/i, '').replace(/\s+/g, '');
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ token: string, staleHours: number, pollInterval: number, language: string }}
 * The config (poll interval in seconds, language 'auto' or a language code).
 * @example
 * normalizeConfig({ token: 'eyJ…', stale_hours: 48 });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    token: readToken(config.token),
    staleHours: readNumber(config.stale_hours, STALE_HOURS),
    pollInterval: readNumber(config.poll_interval, POLL_INTERVAL),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  POLL_INTERVAL,
  STALE_HOURS,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  readToken,
  readLanguage,
};
