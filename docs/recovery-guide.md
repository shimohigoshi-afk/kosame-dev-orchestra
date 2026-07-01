# KOSAME Dev Orchestra Recovery Guide

## Quick Recovery

- 1. Check current status: `npm run ops:validate`
- 2. Restore canonical test.html: `npm run smoke:cleanup`
- 3. Verify all smokes: `npm run verify`
- 4. Check last known good: `.kosame-state/last-known-good.json`

## Rollback Steps

- 1. `git log --oneline -5` to see recent commits
- 2. `git reset --soft` to unstage if needed
- 3. `git checkout public/test.html` if smoke residue
- 4. `git checkout package.json` if version issue
- 5. `npm run verify` to confirm rollback success

## Generated Files

- .kosame-executor/* (generated, not committed)
- .kosame-runner/ (runtime state)
- .kosame-state/ (last known good)
- .kosame-logs/ (operational logs)

## Never Destroy

- .env / credentials / Secret files
- /home/lavie/repos/kosame-sales-dx
- /home/lavie/repos/transcriber
- Customer data / Insurance logic
- FK大宮LP / KOSAME LP assets

generated_at: 2026-07-01T10:30:32.666Z
