// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen. Vocabulary of the Gladys interface:
// appareil / Gerät / dispositivo, scène / Szene / escena. BorgBase says
// "repository" (dépôt, Repository, repositorio).
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // --- Devices ---------------------------------------------------------------
  repositoryDeviceName: {
    en: 'BorgBase {name}',
    fr: 'BorgBase {name}',
    de: 'BorgBase {name}',
    es: 'BorgBase {name}',
  },
  accountDeviceName: {
    en: 'BorgBase account {name}',
    fr: 'Compte BorgBase {name}',
    de: 'BorgBase-Konto {name}',
    es: 'Cuenta BorgBase {name}',
  },
  featureUsage: {
    en: 'Repository size',
    fr: 'Taille du dépôt',
    de: 'Repository-Größe',
    es: 'Tamaño del repositorio',
  },
  featureQuotaUsed: {
    en: 'Quota used',
    fr: 'Quota utilisé',
    de: 'Kontingent belegt',
    es: 'Cuota usada',
  },
  featureHoursSinceBackup: {
    en: 'Time since last backup',
    fr: 'Temps depuis la dernière sauvegarde',
    de: 'Zeit seit der letzten Sicherung',
    es: 'Tiempo desde la última copia',
  },
  featureTotalUsage: {
    en: 'Total usage',
    fr: 'Espace utilisé',
    de: 'Belegter Speicher',
    es: 'Espacio usado',
  },
  featureStorageUsed: {
    en: 'Storage limit used',
    fr: 'Limite de stockage utilisée',
    de: 'Speicherlimit belegt',
    es: 'Límite de almacenamiento usado',
  },
  featureRepositories: {
    en: 'Repositories',
    fr: 'Dépôts',
    de: 'Repositories',
    es: 'Repositorios',
  },
  featureOverdueRepositories: {
    en: 'Overdue backups',
    fr: 'Sauvegardes en retard',
    de: 'Überfällige Sicherungen',
    es: 'Copias atrasadas',
  },

  // --- Durations -------------------------------------------------------------
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },
  duration_hours: { en: '{n} h', fr: '{n} h', de: '{n} Std.', es: '{n} h' },
  duration_days: { en: '{n} days', fr: '{n} jours', de: '{n} Tage', es: '{n} días' },

  // --- Scene summaries -------------------------------------------------------
  summaryBackupReceived: {
    en: 'New backup in the BorgBase repository {name}.',
    fr: 'Nouvelle sauvegarde dans le dépôt BorgBase {name}.',
    de: 'Neue Sicherung im BorgBase-Repository {name}.',
    es: 'Nueva copia en el repositorio BorgBase {name}.',
  },
  summaryBackupResumed: {
    en: 'Backups of the BorgBase repository {name} are back.',
    fr: 'Les sauvegardes du dépôt BorgBase {name} ont repris.',
    de: 'Die Sicherungen des BorgBase-Repositorys {name} laufen wieder.',
    es: 'Las copias del repositorio BorgBase {name} se han reanudado.',
  },
  summaryBackupOverdue: {
    en: 'No new backup in the BorgBase repository {name} for {since}.',
    fr: 'Aucune nouvelle sauvegarde dans le dépôt BorgBase {name} depuis {since}.',
    de: 'Seit {since} keine neue Sicherung im BorgBase-Repository {name}.',
    es: 'Ninguna copia nueva en el repositorio BorgBase {name} desde hace {since}.',
  },
  summaryNeverBackedUp: {
    en: 'The BorgBase repository {name} has never received a backup.',
    fr: 'Le dépôt BorgBase {name} n’a jamais reçu de sauvegarde.',
    de: 'Das BorgBase-Repository {name} hat noch nie eine Sicherung erhalten.',
    es: 'El repositorio BorgBase {name} nunca ha recibido una copia.',
  },
  summaryQuotaRepository: {
    en: 'The BorgBase repository {name} uses {percent} % of its {quota} GB quota.',
    fr: 'Le dépôt BorgBase {name} utilise {percent} % de son quota de {quota} Go.',
    de: 'Das BorgBase-Repository {name} belegt {percent} % seines Kontingents von {quota} GB.',
    es: 'El repositorio BorgBase {name} usa el {percent} % de su cuota de {quota} GB.',
  },
  summaryQuotaAccount: {
    en: 'The BorgBase account uses {percent} % of its {limit} GB storage limit.',
    fr: 'Le compte BorgBase utilise {percent} % de sa limite de stockage de {limit} Go.',
    de: 'Das BorgBase-Konto belegt {percent} % seines Speicherlimits von {limit} GB.',
    es: 'La cuenta BorgBase usa el {percent} % de su límite de almacenamiento de {limit} GB.',
  },

  // --- Scene action outputs --------------------------------------------------
  outputRepository: {
    en: '{name}: {usage} GB.',
    fr: '{name} : {usage} Go.',
    de: '{name}: {usage} GB.',
    es: '{name}: {usage} GB.',
  },
  outputLastBackup: {
    en: 'Last backup {since} ago.',
    fr: 'Dernière sauvegarde il y a {since}.',
    de: 'Letzte Sicherung vor {since}.',
    es: 'Última copia hace {since}.',
  },
  outputNoBackup: {
    en: 'No backup yet.',
    fr: 'Aucune sauvegarde pour l’instant.',
    de: 'Noch keine Sicherung.',
    es: 'Todavía ninguna copia.',
  },
  outputQuota: {
    en: 'Quota used: {percent} %.',
    fr: 'Quota utilisé : {percent} %.',
    de: 'Kontingent belegt: {percent} %.',
    es: 'Cuota usada: {percent} %.',
  },
  outputAccount: {
    en: '{count} BorgBase repositories, {usage} GB in all.',
    fr: '{count} dépôts BorgBase, {usage} Go au total.',
    de: '{count} BorgBase-Repositories, insgesamt {usage} GB.',
    es: '{count} repositorios BorgBase, {usage} GB en total.',
  },
  outputStorage: {
    en: 'Storage limit used: {percent} % of {limit} GB.',
    fr: 'Limite de stockage utilisée : {percent} % de {limit} Go.',
    de: 'Speicherlimit belegt: {percent} % von {limit} GB.',
    es: 'Límite de almacenamiento usado: {percent} % de {limit} GB.',
  },
  outputOverdue: {
    en: 'Overdue backups ({count}): {names}.',
    fr: 'Sauvegardes en retard ({count}) : {names}.',
    de: 'Überfällige Sicherungen ({count}): {names}.',
    es: 'Copias atrasadas ({count}): {names}.',
  },
  outputAllRecent: {
    en: 'Every backup is recent.',
    fr: 'Toutes les sauvegardes sont récentes.',
    de: 'Alle Sicherungen sind aktuell.',
    es: 'Todas las copias son recientes.',
  },

  // --- Widgets ---------------------------------------------------------------
  planHeading: {
    en: 'BorgBase {plan}',
    fr: 'BorgBase {plan}',
    de: 'BorgBase {plan}',
    es: 'BorgBase {plan}',
  },
  storageUsed: {
    en: 'Storage used',
    fr: 'Stockage utilisé',
    de: 'Speicher belegt',
    es: 'Almacenamiento usado',
  },
  totalUsage: { en: 'Total usage', fr: 'Espace utilisé', de: 'Belegt', es: 'Espacio usado' },
  repositories: { en: 'Repositories', fr: 'Dépôts', de: 'Repositories', es: 'Repositorios' },
  overdueBackups: { en: 'Overdue', fr: 'En retard', de: 'Überfällig', es: 'Atrasadas' },
  moreRepositories: {
    en: '{n} more repositories',
    fr: '{n} autres dépôts',
    de: '{n} weitere Repositories',
    es: '{n} repositorios más',
  },
  overageOverdue: {
    en: 'Overage invoice overdue',
    fr: 'Facture de dépassement impayée',
    de: 'Mehrverbrauchsrechnung überfällig',
    es: 'Factura de exceso vencida',
  },
  allBackupsRecent: {
    en: 'All backups recent',
    fr: 'Sauvegardes à jour',
    de: 'Alle Sicherungen aktuell',
    es: 'Copias al día',
  },
  openBorgBase: {
    en: 'Open BorgBase',
    fr: 'Ouvrir BorgBase',
    de: 'BorgBase öffnen',
    es: 'Abrir BorgBase',
  },
  badgeOk: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
  badgeOverdue: { en: 'Overdue', fr: 'En retard', de: 'Überfällig', es: 'Atrasada' },
  badgeNever: { en: 'Never', fr: 'Jamais', de: 'Nie', es: 'Nunca' },
  badgeEmpty: { en: 'Empty', fr: 'Vide', de: 'Leer', es: 'Vacío' },
  badgeQuota: {
    en: 'Quota {percent} %',
    fr: 'Quota {percent} %',
    de: 'Kont. {percent} %',
    es: 'Cuota {percent} %',
  },
  neverBackedUp: {
    en: 'never backed up',
    fr: 'jamais sauvegardé',
    de: 'nie gesichert',
    es: 'nunca copiado',
  },
  quotaShort: {
    en: '{percent} % of quota',
    fr: '{percent} % du quota',
    de: '{percent} % Kontingent',
    es: '{percent} % de la cuota',
  },
  lineUsage: {
    en: 'Size {size} (quota: {quota})',
    fr: 'Taille {size} (quota : {quota})',
    de: 'Größe {size} (Kontingent: {quota})',
    es: 'Tamaño {size} (cuota: {quota})',
  },
  noQuota: { en: 'none', fr: 'aucun', de: 'keins', es: 'ninguna' },
  lineLastBackup: {
    en: 'Last backup: {last}',
    fr: 'Dernière sauvegarde : {last}',
    de: 'Letzte Sicherung: {last}',
    es: 'Última copia: {last}',
  },
  thresholdLine: {
    en: 'Overdue after {since}',
    fr: 'En retard après {since}',
    de: 'Überfällig nach {since}',
    es: 'Atrasada después de {since}',
  },
  appendOnly: {
    en: 'Append-only',
    fr: 'Ajout seul (append-only)',
    de: 'Nur anhängen (append-only)',
    es: 'Solo añadir (append-only)',
  },
  shownOf: {
    en: '{shown} of {total} repositories',
    fr: '{shown} dépôts sur {total}',
    de: '{shown} von {total} Repositories',
    es: '{shown} de {total} repositorios',
  },
  wholeAccount: {
    en: 'Whole account',
    fr: 'Tout le compte',
    de: 'Ganzes Konto',
    es: 'Toda la cuenta',
  },
  usageHistory: {
    en: 'Usage history',
    fr: 'Historique de l’espace',
    de: 'Verlauf der Belegung',
    es: 'Historial de uso',
  },
  createDeviceForHistory: {
    en: 'Add this device on the BorgBase Discovery screen to see its history.',
    fr: 'Ajoutez cet appareil dans l’écran Découverte de BorgBase pour voir son historique.',
    de: 'Füge dieses Gerät im Bildschirm Erkennung von BorgBase hinzu, um seinen Verlauf zu sehen.',
    es: 'Añada este dispositivo en la pantalla Descubrimiento de BorgBase para ver su historial.',
  },
  noRepository: {
    en: 'No repository on this BorgBase account.',
    fr: 'Aucun dépôt sur ce compte BorgBase.',
    de: 'Kein Repository in diesem BorgBase-Konto.',
    es: 'Ningún repositorio en esta cuenta BorgBase.',
  },

  // --- Configuration and status ------------------------------------------------
  noToken: {
    en: 'Enter a BorgBase API token in the configuration.',
    fr: 'Saisissez un jeton d’API BorgBase dans la configuration.',
    de: 'Gib ein BorgBase-API-Token in der Konfiguration ein.',
    es: 'Introduzca un token de API de BorgBase en la configuración.',
  },
  notReadYet: {
    en: 'BorgBase has not been read yet.',
    fr: 'BorgBase n’a pas encore été lu.',
    de: 'BorgBase wurde noch nicht gelesen.',
    es: 'BorgBase aún no se ha leído.',
  },
  statusConnected: {
    en: 'Connected to BorgBase: {count} repositories, {overdue} overdue.',
    fr: 'Connecté à BorgBase : {count} dépôts, {overdue} en retard.',
    de: 'Mit BorgBase verbunden: {count} Repositories, {overdue} überfällig.',
    es: 'Conectado a BorgBase: {count} repositorios, {overdue} atrasados.',
  },
  statusNoAccount: {
    en: 'The token cannot read the account: no account device.',
    fr: 'Le jeton ne peut pas lire le compte : pas d’appareil de compte.',
    de: 'Das Token kann das Konto nicht lesen: kein Kontogerät.',
    es: 'El token no puede leer la cuenta: sin dispositivo de cuenta.',
  },
  statusInvalidToken: {
    en: 'BorgBase refuses the API token: check it, or its expiry date, in Account > API.',
    fr: 'BorgBase refuse le jeton d’API : vérifiez-le, ou sa date d’expiration, dans Account > API.',
    de: 'BorgBase lehnt das API-Token ab: prüfe es oder sein Ablaufdatum unter Account > API.',
    es: 'BorgBase rechaza el token de API: compruébelo, o su fecha de caducidad, en Account > API.',
  },
  statusRateLimited: {
    en: 'BorgBase asks to slow down: the next reading waits.',
    fr: 'BorgBase demande de ralentir : la prochaine lecture attend.',
    de: 'BorgBase bittet um weniger Anfragen: die nächste Abfrage wartet.',
    es: 'BorgBase pide reducir el ritmo: la próxima lectura espera.',
  },
  statusServer: {
    en: 'BorgBase answered with an error: new try at the next reading.',
    fr: 'BorgBase a répondu par une erreur : nouvel essai à la prochaine lecture.',
    de: 'BorgBase hat mit einem Fehler geantwortet: neuer Versuch bei der nächsten Abfrage.',
    es: 'BorgBase respondió con un error: nuevo intento en la próxima lectura.',
  },
  statusUnreachable: {
    en: 'BorgBase is unreachable for now: new try at the next reading.',
    fr: 'BorgBase est injoignable pour l’instant : nouvel essai à la prochaine lecture.',
    de: 'BorgBase ist gerade nicht erreichbar: neuer Versuch bei der nächsten Abfrage.',
    es: 'BorgBase no está accesible por ahora: nuevo intento en la próxima lectura.',
  },
  testOk: {
    en: 'Token accepted: {count} repositories read, {overdue} with an overdue backup.',
    fr: 'Jeton accepté : {count} dépôts lus, dont {overdue} avec une sauvegarde en retard.',
    de: 'Token akzeptiert: {count} Repositories gelesen, {overdue} mit überfälliger Sicherung.',
    es: 'Token aceptado: {count} repositorios leídos, {overdue} con una copia atrasada.',
  },
};

/**
 * @description Whether a value is one of the supported languages.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de or es.
 * @example
 * isLanguage('fr'); // -> true
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, with its substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('featureUsage', 'fr'); // -> 'Taille du dépôt'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusConnected', { count: 3, overdue: 0 });
 */
function all(key, values = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, t(key, language, values)]));
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 * @example
 * ago(Date.now() - 600000, Date.now(), 'en'); // -> '10 min ago'
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

/**
 * @description "30 h" or "3 days" for a number of hours.
 * @param {number|null} hours - The duration.
 * @param {string} language - The language.
 * @returns {string} The text, '?' when unknown.
 * @example
 * duration(72, 'fr'); // -> '3 jours'
 */
function duration(hours, language) {
  if (!Number.isFinite(hours)) {
    return '?';
  }
  if (hours < 48) {
    return t('duration_hours', language, { n: Math.round(hours) });
  }
  return t('duration_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, isLanguage, t, all, ago, duration };
