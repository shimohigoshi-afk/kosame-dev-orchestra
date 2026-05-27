# Dev Factory MVP v6.0.0

## Overview

The Dev Factory MVP orchestrates multi-provider AI development work across KOSAME product lines, from task intake through human-approved release.

## Product Lines

| Product Line          | Primary Provider | Bulk Provider | Breakthrough |
|-----------------------|------------------|---------------|--------------|
| sales_dx              | claude           | gemini        | grok         |
| email_reply           | claude           | gemini        | grok         |
| ai_bot                | claude           | gemini        | grok         |
| backoffice            | claude           | gemini        | grok         |
| anesty_board          | kosame           | gemini        | grok         |
| cloud_run_launch_pack | claude           | gemini        | kosame       |

## Work Breakdown Phases

1. **design** — owner: kosame, no human approval needed
2. **implementation** — owner: claude, human approval required
3. **bulk_draft** — owner: gemini, human approval required
4. **verify** — owner: cloudShell, human approval required
5. **release** — owner: human, human approval required

## Safety Rules

### Data Boundary
- Level A: safe for all external providers
- Level B: kosame, claude, cloudShell, human only
- Level C: kosame and human only

### Blocked for External Providers
customer data, Secret, .env, API key, insurance policy, health check, personal name, private contract

### Blocked Dangerous Actions
git commit, git push, git tag, deploy, docker build, gcloud run deploy, rm -rf, git reset --hard, git clean, Secret value read, .env value read, API key value read, customer data sharing, insurance policy sharing, health check info sharing, personal name in minutes sharing

### Provider Constraints
- DeepSeek / Kimi: Level A only, fully sanitized and anonymized input
- じゅんやさん: final YES only — does not return to worker role

## Usage

```js
const tool = require('./tools/dev-factory-mvp-pack.js');
const packet = tool.buildPacket({
  projectName: 'my-project',
  repoPath: '.',
  taskGoal: 'implement release note generator',
  productLine: 'backoffice',
  riskLevel: 'low',
  preferredProviders: ['claude', 'gemini']
});
console.log(JSON.stringify(packet, null, 2));
```

## Safety Invariants

- `dryRun` is always true — nothing executes automatically.
- `humanApprovalRequired` is always true at every stage.
- Sanitization check runs on `taskGoal` before provider assignment.
- If sanitization fails, `recommendedNextAction` instructs the user to sanitize before dispatching.
