# Task Execution Packet Generator v7.2.0

## Purpose

Claude / Gemini / Grok / DeepSeek / Kimi / Human Approvalにそのまま渡せる実行パケットを生成する。
触ってよいファイル、触ってはいけないファイル、検証コマンド、完了条件、禁止事項、報告形式を含める。

## Inputs

| Field | Type | Default | Description |
|---|---|---|---|
| taskGoal | string | (task goal) | タスク目標 |
| taskType | string | implementation | implementation / draft / strategy / review / repair / release / bugfix / docs / bulk |
| productLine | string | backoffice | sales_dx / email_reply / ai_bot / backoffice / anesty_board / cloud_run_launch_pack |
| riskLevel | string | low | low / medium / high / critical |
| dataLevel | string | A | A / B / C |
| provider | string | claude | claude / gemini / grok / deepseek / kimi / kosame / human |
| repoPath | string | . | リポジトリパス |

## Outputs

| Field | Description |
|---|---|
| version | 7.2.0 |
| dryRun | true (always) |
| humanApprovalRequired | true (always) |
| packetId | ユニーク実行パケットID |
| allowedFiles | 触ってよいファイルパターン一覧 |
| deniedFiles | 触ってはいけないファイルパターン一覧 |
| verifyCommands | 検証コマンド一覧 |
| doneCriteria | 完了条件一覧 |
| forbiddenActions | 禁止アクション一覧 |
| reportFormat | JSON形式の報告書フォーマット |
| dataLevelNote | データレベル説明 |
| recommendedNextAction | 次アクション推奨 |

## Always Denied Files

```
.env, .env.*, *.pem, *.key, secrets/**, credentials/**,
**/node_modules/**, .git/**, Dockerfile,
cloud-run/**, apps/pm-agent/**
```

## Verify Commands (Standard)

1. `node --check {newFiles}` — Syntax check
2. `npm run smoke:{packSlug}` — Specific smoke test
3. `npm run verify` — Full suite
4. `git diff --stat HEAD` — Non-empty diff check
5. `git status --short` — Clean working tree check

## Report Format

```json
{
  "status": "success | failure | incomplete | needs_repair | pending_approval",
  "summary": "何をしたかの要約",
  "filesChanged": ["tools/example.js"],
  "verifyResult": "npm run verify PASS",
  "issues": [],
  "nextAction": "次のアクション"
}
```

## Data Level Rules

| Level | Rule |
|---|---|
| A | All providers allowed (anonymize for deepseek/kimi) |
| B | claude allowed; gemini/grok require anonymization |
| C | kosame or human only — no external provider dispatch |
