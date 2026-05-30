# Provider Prompt Router Real Use Pack v7.1.0

## Purpose

v6.5.0 Provider Prompt Router CLIを、v7.0.0 Practical Dev Factory Runtime内の実タスクで使いやすくする。
taskType / productLine / riskLevel / dataLevel から、実用的なprovider routeと貼り付け用prompt packetを生成する。

## Inputs

| Field | Type | Default | Description |
|---|---|---|---|
| taskType | string | implementation | implementation / draft / strategy / review / repair / release / bugfix / docs / bulk |
| productLine | string | backoffice | sales_dx / email_reply / ai_bot / backoffice / anesty_board / cloud_run_launch_pack |
| riskLevel | string | low | low / medium / high / critical |
| dataLevel | string | A | A / B / C |
| preferredProvider | string\|null | null | claude / gemini / grok / deepseek / kimi / kosame / human |
| taskGoal | string | (task goal) | 実際のタスク目標 |

## Outputs

| Field | Description |
|---|---|
| version | 7.1.0 |
| dryRun | true (always) |
| humanApprovalRequired | true (always) |
| providerRoute | selectedProvider, reason, fallbacks |
| promptPacket | provider, prompt (貼り付け用), tier, humanApprovalRequired |
| safetyCheck | safe, reason |
| contextualGuidance | productLineGuidance, riskNote, taskTypeNote |
| blockedDangerousActions | 禁止アクション一覧 |
| recommendedNextAction | 次のアクション推奨 |

## Usage

```bash
node tools/provider-prompt-router-real-use-pack.js
```

env vars:
- KOSAME_TASK_TYPE
- KOSAME_PRODUCT_LINE
- KOSAME_RISK_LEVEL
- KOSAME_DATA_LEVEL
- KOSAME_PREFERRED_PROVIDER
- KOSAME_TASK_GOAL

## Product Line Guidance

| productLine | External Provider Policy |
|---|---|
| sales_dx | No customer PII in external providers |
| email_reply | Strip customer names and contact info before dispatch |
| ai_bot | No actual user conversation data to external |
| backoffice | Sanitize employee data before dispatch |
| anesty_board | Level C protection — kosame or human review only |
| cloud_run_launch_pack | Human approval required for any deploy action |

## Safety Rules

- Level C data → kosame or human only (no external provider)
- critical risk → kosame only
- review / safety / final / release → kosame
- ANESTY Board → kosame or human (health/insurance data)
- dryRun=true 固定
- humanApprovalRequired=true 固定
- DeepSeek/Kimi: Level A + anonymized only
