# KOSAME Dev Orchestra v6.1.0 Real Status Importer Plus

## Purpose

This release extends the Dev Factory with real-state import capability, pulling git status, package version, GitHub Actions run results, provider availability, and verify results into a unified snapshot for decision-making.

## Imported Sources

| Source          | Key Fields                                         |
|-----------------|----------------------------------------------------|
| git_status      | clean, modified, untracked, staged, totalChanges   |
| package_version | version, major, minor, patch                       |
| gh_run_list     | total, passing, failing, pending, latestStatus     |
| provider_status | statuses per provider, downProviders, allUp        |
| verify_status   | passed, failedSmokes, totalSmokes, lastRun         |

## Ready-for-Dispatch Signal

`readyForDispatch` is true only when: git is clean, verify passed, and no GitHub Actions failures.

## Release Value

v6.1.0 gives こさめ副社長 a single real-state snapshot to evaluate before any Dev Factory dispatch, replacing manual status checks.
