// -----------------------------------------------------------------------------
// Entry point of the BorgBase external integration.
//
// Watches the backup repositories of a BorgBase account and brings them into
// Gladys:
//   - a device per repository and one for the account (Discovery screen):
//     usage, quota used, time since the last backup, overdue backups;
//   - scene triggers: backup received, backup overdue, backups resumed,
//     quota level reached;
//   - scene actions: read a repository, read the account;
//   - dashboard widgets: overview, repositories, usage history.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the BorgBase integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
