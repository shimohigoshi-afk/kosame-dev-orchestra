# Multi-Provider Backup Console v5.5.0

## Overview

When a primary provider is unavailable, the backup console selects an alternative provider from the backup matrix.

## Selection Algorithm

1. If `dataLevel` is C and the provider is not kosame/human → route immediately to kosame.
2. Look up the backup matrix for the primary provider.
3. Iterate through `backups` in order; select the first that is not in `unavailable`.
4. If all backups are exhausted, use `finalBackup` (always kosame).

## Policy

- `maxBackupAttempts`: 2
- `alwaysHumanApprovalRequired`: true
- `blockOnDataLevelC`: true — Level C data never reaches external backups.

## Safety Invariants

- Backup selection does not bypass safety boundary or prompt template checks.
- Human approval is required for all external provider dispatches regardless of backup depth.
- こさめ副社長 (kosame) is the final backup for all tier-1 and tier-2 providers.
