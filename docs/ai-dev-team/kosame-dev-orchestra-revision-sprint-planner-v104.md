# KOSAME Dev Orchestra Revision Sprint Planner v104.0.0

## Purpose
Convert feedback into small revision sprints.

## Priority Levels
P0_critical → P1_high → P2_medium → P3_low

## Sprint Structure
- sprintId, product, priority
- allowedFiles, forbiddenFiles (.env always forbidden)
- verificationCommands (node --check, npm run verify)
- doneCriteria (smoke passes, dryRun: true, humanApprovalRequired: true)
- rollbackNotes
- ownerRoute (ClaudeCode / Human)
- humanApprovalRequired

## Owner Routing
| Severity | Owner |
|----------|-------|
| critical | Human (Junya YES required) |
| high/medium/low | ClaudeCode |

## Tool
`tools/dev-agent-revision-sprint-planner-pack.js`

## Version
104.0.0
