# KOSAME Dev Orchestra Human Approval Compression v102.0.0

## Purpose
Compress human decisions into minimal YES/NO gates.

## Operating Principle
**Guard only irreversible danger zones; move fast everywhere else.**

## Human Approval Gates (Always Require Junya YES)
- deploy
- git push
- git tag
- secret access
- .env read
- customer data access
- Gmail/PDF data access
- real send
- contract execution
- billing
- destructive delete

## Safe AI-Executable Tasks (No Human Required)
- file editing (non-secret)
- smoke test execution
- dry-run report generation
- fixture/mock data creation
- node --check syntax validation
- npm run verify
- planning / task ordering
- doc generation
- git status / git diff (read-only)

## Tool
`tools/dev-agent-human-approval-compression-pack.js`

## Version
102.0.0
