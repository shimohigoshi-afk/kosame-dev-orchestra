# KOSAME Dev Orchestra v2.8.0 Release Record
## One-shot Operation Plan Generator

**Version:** 2.8.0  
**Release Date:** 2026-05-27  
**Release Manager:** Claude係長  
**Final Approval:** じゅんやさん社長

---

## Summary

v2.8.0 implements the **One-shot Operation Plan Generator** — tools that produce complete, structured operation plans combining Claude prompts, Gemini bulk prompts, safe command sequences, and human approval summaries into a single packet.

---

## New Tools (5)

| Tool | Function | Description |
|------|----------|-------------|
| `tools/one-shot-operation-plan.js` | `generateOneShotOperationPlan` | Master planner combining all sub-generators |
| `tools/safe-command-plan-generator.js` | `generateSafeCommandPlan`, `classifyCommand` | Classifies commands as safe/dangerous, builds step plan |
| `tools/claude-task-prompt-generator.js` | `generateClaudeTaskPrompt` | Structured prompt for Claude係長 tasks |
| `tools/gemini-bulk-prompt-generator.js` | `generateGeminiBulkPrompt` | Structured bulk-gen prompt for Gemini課長 |
| `tools/human-approval-summary-generator.js` | `generateHumanApprovalSummary` | Concise approval packet for じゅんやさん |

---

## New Smoke Tests (6)

- `smoke/dev-agent-safe-command-plan-generator-smoke.js`
- `smoke/dev-agent-claude-task-prompt-generator-smoke.js`
- `smoke/dev-agent-gemini-bulk-prompt-generator-smoke.js`
- `smoke/dev-agent-human-approval-summary-generator-smoke.js`
- `smoke/dev-agent-one-shot-operation-plan-smoke.js`
- `smoke/dev-agent-v2.8.0-release-record-smoke.js`

---

## Key Design Decisions

### Dangerous command detection
`DANGEROUS_COMMANDS` list: `git push`, `git tag`, `gcloud deploy`, `docker build`, `rm -rf`, `git reset --hard`, `git clean`.  
Any match → `requiresHumanApproval: true` for that step.

### one-shot-operation-plan always includes claudePrompt
Even pure Gemini or pure human-approval plans include a `claudePrompt` for implementation context.  
`geminiPrompt` is `null` when `needsGemini: false`.  
`approvalSummary` is `null` when no human approval needed.

### human-approval-summary requiresApproval logic
Requires approval when: `APPROVAL_REQUIRED_TYPES.includes(actionType)` OR `riskLevel === 'Critical'` OR `riskLevel === 'High'`.  
Low-risk general actions do NOT require approval.

### suitableForGemini threshold
Gemini bulk gen is suitable when `itemsToGenerate.length >= 3`. Smaller batches recommend Claude fallback.

---

## Compatibility

- All v2.0.0–v2.7.0 tools unchanged
- `dryRun: true` on all new tool outputs
