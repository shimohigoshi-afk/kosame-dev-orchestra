# KOSAME Dev Orchestra Operator Runbook v101.0.0

## Purpose
Create operator runbook structure for using KOSAME Dev Orchestra after v100.

## Runbook Sections
| Section | Automated By | Human Required |
|---------|-------------|----------------|
| restart_check | ClaudeCode | No |
| task_selection | ClaudeCode + GPTAgent | No |
| agent_assignment | GPTAgent routing | No |
| verification | ClaudeCode | No |
| **approval** | **none — human only** | **YES** |
| backup | ClaudeCode | No |
| handoff | ClaudeCode | No |

## Approval Gate (Human Only)
Junya reviews: deploy/push/tag/billing/secret/real send
- YES → proceed
- NO → AI re-plans without the irreversible action

## Quick Reference
- Safe AI tasks: restart_check, task_selection, agent_assignment, verification, backup, handoff
- Human-only: approval

## Tool
`tools/dev-agent-operator-runbook-pack.js`

## Version
101.0.0
