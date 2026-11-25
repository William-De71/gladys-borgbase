# BorgBase

## Overview

This integration watches the backup repositories of a **BorgBase** account (offsite hosting for BorgBackup and restic) in Gladys: the size of each repository, its quota, the time since its last backup, and the storage used by the account. It warns you, through your scenes, when a backup no longer arrives or a quota fills up. It reads the official BorgBase GraphQL API with a **Read Only** API token, and changes nothing on your account.

Each repository becomes a device, and so does the account. Scene triggers react to a new backup, an overdue backup, backups that resume, and a quota that reaches 80, 90 or 100 %.

Transport: cloud. Only `api.borgbase.com` is contacted, every 15 minutes by default; your backups never pass through Gladys.

BorgBase is a service of BorgBase Ltd. This integration is not affiliated with BorgBase.

## Requirements

- Gladys Assistant 5.3.0 or later.
- A BorgBase account with at least one repository.
- An API token: on borgbase.com, open **Account → API**, create a token with the **Read Only** permission (enough, and the safest), give it an expiry date if you wish, and copy it.

## Configuration

| Field                 | Role                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| API token             | The Read Only token.                                                                                                        |
| Overdue after (hours) | For repositories without BorgBase monitoring: 26 by default (a daily backup). A repository with monitoring uses its X days. |
| Refresh interval (s)  | 300 to 3,600 seconds, 900 by default; also the delay of the scene triggers.                                                 |
| Language of the texts | Device names, scene summaries and outputs; automatic by default.                                                            |

Save, then press **Test the connection**: it says how many repositories were read and how many have an overdue backup.

A repository is **overdue** when it received no new backup for longer than its delay: the **Monitoring** of the repository on BorgBase (**Edit repository → Monitoring: X days**) when it is on, otherwise the **Overdue after** field. A repository never written to counts from its creation.

## Usage

### Devices

In **Discover**, create the devices you want:

- **BorgBase account <e-mail>**: total usage (GB), storage limit used (%), repositories, overdue backups.
- **BorgBase <repository>**: repository size (GB), quota used (%, only when the repository has a quota), time since the last backup (hours).

Gladys keeps their history: compare "Time since last backup" to any delay in a scene condition, or draw the size in a chart. A value BorgBase does not give is left out, never set to 0.

### Scene triggers

All of them filter by device (leave empty for any):

- **New backup**: a repository was written to. BorgBase gives the time of the last write, so a prune or a compaction counts too.
- **Backup overdue**: a repository received no new backup within its delay (variables `hours_since_backup`, `threshold_hours`).
- **Backups resumed**: an overdue repository received a backup again.
- **Quota level reached**: a repository (of its quota) or the account (of its storage limit) reaches 80, 90 or 100 %; filters on the level and the scope.

Every event gives the device, the repository name, its size and a `summary` sentence. The first reading after a start, a new token or a new delay is a baseline: nothing fires.

Examples:

- When **Backup overdue** fires → send the `summary` to your phone.
- When **Quota level reached** at 90 % for the account → send a message to think about the plan.
- Every Monday at 9 am → **Read the account**, then send its `summary`.

### Scene actions

- **Read a repository** gives its status (`ok`, `overdue`, `never`), size, quota, hours since the last backup and a `summary` sentence. An unknown number is -1.
- **Read the account** gives the plan, the total usage, the storage limit, the overdue repositories and a `summary` sentence.

### Widgets

![The BorgBase overview widget with the storage gauge, three tiles and the repositories needing attention, the backup repositories widget with a badge per repository, and the usage widget with the size history of a repository (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-borgbase/main/docs/assets/widgets.en.png)

- **BorgBase**: storage limit used, total usage, repositories, overdue backups, the repositories that need attention (overdue, quota at 90 % or more) and a link to BorgBase.
- **Backup repositories**: each repository with its size, quota, last backup and a badge; needs attention first, by name, or largest first.
- **BorgBase usage**: the size history of a repository, or of the whole account. The history is the one Gladys keeps: create the device first.

## Troubleshooting

- **"BorgBase refuses the API token"**: the token is wrong, expired or deleted: create a new one in **Account → API**.
- **"The token cannot read the account"**: the token reads the repositories only; the account device and the storage limit are left out.
- **"BorgBase asks to slow down"**: raise the refresh interval.
- **A backup shows as overdue too early**: check the **Monitoring** of the repository on BorgBase, or raise **Overdue after**.
- Report a problem with the versions of Gladys and of the integration and its logs; never paste your token.
