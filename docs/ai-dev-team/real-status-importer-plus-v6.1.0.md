# Real Status Importer Plus v6.1.0

## Overview

The Real Status Importer Plus aggregates real-world project state from multiple sources into a single structured snapshot.

## Import Functions

### importGitStatus(raw)
Parses raw `git status --short` output into `{ clean, modified, untracked, staged, totalChanges }`.

### importPackageVersion(version)
Parses a semver string into `{ version, major, minor, patch }`.

### importGhRunList(runs)
Summarizes GitHub Actions run objects into `{ total, passing, failing, pending, latestStatus }`.

### importProviderStatus(statuses)
Merges input with provider defaults to produce `{ statuses, downProviders, allUp }`.

### importVerifyStatus(result)
Normalizes a verify result into `{ passed, failedSmokes, totalSmokes, lastRun }`.

### buildSnapshot(input)
Calls all importers and returns a unified snapshot object.

## Ready-for-Dispatch Logic

`readyForDispatch` requires all three:
1. `gitStatus.clean === true`
2. `verifyStatus.passed === true`
3. `ghRunList.failing === 0`

## Safety Invariants

- All imports are read-only — no files are written or commands executed.
- `humanApprovalRequired` is always true.
- `dryRun` is always true.
