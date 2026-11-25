// -----------------------------------------------------------------------------
// Snapshots -> scene trigger transitions (pure logic, no I/O).
//
// One event per transition between two rounds, never a periodic snapshot:
//   - `backup_received`        the repository was written to (its
//                              `lastModified` moved forward);
//   - `backup_overdue`         no new backup for longer than its threshold
//                              (the repository was fine at the last round);
//   - `backup_resumed`         an overdue repository was written to again;
//   - `quota_level_reached`    the usage of a repository (of its quota) or of
//                              the account (of its storage limit) reached a
//                              higher level among 80, 90 and 100 %.
//
// The first round (no previous snapshot) is a baseline: nothing fires after a
// restart or a token change. A repository seen for the first time is a
// baseline too.
// -----------------------------------------------------------------------------

const SCENE_TRIGGERS = {
  BACKUP_RECEIVED: 'backup_received',
  BACKUP_OVERDUE: 'backup_overdue',
  BACKUP_RESUMED: 'backup_resumed',
  QUOTA_LEVEL_REACHED: 'quota_level_reached',
};

/**
 * @description The transitions of a repository between two rounds.
 * @param {object|null} previous - The snapshot of the previous round.
 * @param {object} next - The snapshot of this round.
 * @returns {Array<{ key: string }>} The events, in the order they happened.
 * @example
 * diffRepository(previous, next); // -> [{ key: 'backup_received' }]
 */
function diffRepository(previous, next) {
  if (!previous) {
    return [];
  }
  const events = [];
  const written =
    next.lastBackupAt !== null &&
    (previous.lastBackupAt === null || next.lastBackupAt > previous.lastBackupAt);
  if (written) {
    events.push({ key: SCENE_TRIGGERS.BACKUP_RECEIVED });
    if (previous.overdue && !next.overdue) {
      events.push({ key: SCENE_TRIGGERS.BACKUP_RESUMED });
    }
  }
  if (!previous.overdue && next.overdue) {
    events.push({ key: SCENE_TRIGGERS.BACKUP_OVERDUE });
  }
  if (next.level > previous.level) {
    events.push({ key: SCENE_TRIGGERS.QUOTA_LEVEL_REACHED, level: next.level });
  }
  return events;
}

/**
 * @description The transitions of the account between two rounds: only the
 * storage limit levels.
 * @param {object|null} previous - The account of the previous round.
 * @param {object|null} next - The account of this round.
 * @returns {Array<{ key: string, level: number }>} The events.
 */
function diffAccount(previous, next) {
  if (!previous || !next || previous.id !== next.id) {
    return [];
  }
  return next.level > previous.level
    ? [{ key: SCENE_TRIGGERS.QUOTA_LEVEL_REACHED, level: next.level }]
    : [];
}

export { SCENE_TRIGGERS, diffRepository, diffAccount };
