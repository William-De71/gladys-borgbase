# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-11-25

### Added

- **devices:** the backup repositories of a BorgBase account through the official GraphQL API with a Read Only API token; one device per repository (size, quota used, time since the last backup) and one for the account (total usage, storage limit used, repositories, overdue backups)
- **scenes:** triggers when a backup arrives, when a repository has no new backup within its delay (the BorgBase monitoring of the repository, or a delay of your own), when backups resume, and when a repository quota or the account storage limit reaches 80, 90 or 100 %; actions that read a repository and the account, with ready-made sentences
- **widgets:** an overview of the account (storage used, overdue backups, what needs attention), the list of repositories with their status, and the usage history of a repository or of the whole account
- **configuration:** API token, delay before a backup is overdue, reading interval, language, "Test the connection" button
- **i18n:** English, French, German and Spanish for the manifest, the runtime texts, the documentation and the README

[0.1.0]: https://github.com/William-De71/gladys-borgbase/releases/tag/v0.1.0
