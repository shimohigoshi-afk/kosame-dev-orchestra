# Practical Dev Factory Runtime v7.0.0

## Overview

Practical Dev Factory Runtime はv6.0.0 Dev Factory MVP とv6.5.0 Provider Prompt Router CLI を統合し、実際の小さい開発タスクを1本のパイプラインで流せるRuntimeです。

## 設計思想

### 接続する先行パック

| パック | 採用した思想 |
|--------|------------|
| `dev-factory-mvp-pack` (v6.0.0) | workBreakdown / humanApprovalPacket / blockedDangerousActions の構造 |
| `provider-prompt-router-cli-pack` (v6.5.0) | provider選定ロジック / safetyBoundary / promptPacket生成 |
| `real-status-importer-plus-pack` | currentStatusの取り込みとrealStatusSummary生成 |
| `issue-ticket-runner-pack` | タスクのnormalize / workBreakdown phases化 |
| `product-specific-generator-pack` | productLine別のprovider割り当て (PRODUCT_PROVIDER_MAP) |

## 入力スキーマ

```json
{
  "projectName":       "string — プロジェクト識別子",
  "repoPath":          "string — リポジトリパス",
  "taskGoal":          "string — タスクの目的",
  "productLine":       "sales_dx | email_reply | ai_bot | backoffice | anesty_board | cloud_run_launch_pack",
  "taskType":          "implementation | draft | strategy | review | repair | release",
  "riskLevel":         "low | medium | high | critical",
  "dataLevel":         "A | B | C",
  "preferredProvider": "claude | gemini | grok | deepseek | kimi | kosame | null",
  "currentStatus":     "string — 現在のステータス文字列"
}
```

## 出力スキーマ

```json
{
  "version":               "7.0.0",
  "title":                 "Practical Dev Factory Runtime",
  "dryRun":                true,
  "humanApprovalRequired": true,
  "runtimeId":             "string — 一意のRuntime ID",
  "projectName":           "string",
  "repoPath":              "string",
  "normalizedTask":        { "taskGoal", "taskType", "productLine", "riskLevel", "dataLevel", "hasBlockedKeyword", "safeForExternal" },
  "realStatusSummary":     { "productLine", "rawStatus", "importedAt", "statusClass", "note" },
  "workBreakdown":         { "taskGoal", "taskType", "productLine", "phases": [...] },
  "providerRoute":         { "selectedProvider", "reason", "fallbacks": [...] },
  "executionPackets":      [ { "provider", "taskType", "productLine", "prompt", "tier", "humanApprovalRequired" }, ... ],
  "verificationPlan":      { "taskType", "productLine", "steps": [...], "humanApprovalRequired": true },
  "repairLoopPlan":        { "enabled", "maxRetries", "repairOwner", "escalationOnFailure", "gateOnEachRetry", "steps": [...] },
  "humanApprovalPacket":   { "actionsRequiringApproval": [...], "humanApprovalRequired": true, "note" },
  "blockedDangerousActions": [...],
  "recommendedNextAction": "string"
}
```

## Provider Routing ルール

```
implementation → claude
repair         → claude
draft          → gemini
strategy       → grok
review         → kosame
release        → kosame → human approval
Level C data   → kosame or human ONLY
critical risk  → kosame or human ONLY
```

## productLine別プライマリProvider

| productLine | primary | bulk | breakthrough |
|-------------|---------|------|-------------|
| sales_dx | claude | gemini | grok |
| email_reply | claude | gemini | grok |
| ai_bot | claude | gemini | grok |
| backoffice | claude | gemini | grok |
| anesty_board | **kosame** | gemini | grok |
| cloud_run_launch_pack | claude | gemini | **kosame** |

## workBreakdown Phases

| phase | owner | humanApproval |
|-------|-------|---------------|
| intake | kosame | false |
| design | kosame | false |
| implementation | claude | true |
| bulk_draft | gemini | true |
| verify | cloudShell | true |
| repair_loop | claude | true |
| release | **human** | true |

## 安全要件

- `dryRun: true` — 常に強制
- `humanApprovalRequired: true` — 常に強制
- Level C データは外部Provider不可
- Secret / .env / API key / 顧客情報 / 保険証券 / 健診情報 / 個人名入り議事録は外部Providerへ渡さない
- deploy / git push / git tag / docker build / gcloud deploy / destructive action → Human Approval必須
- DeepSeek / Kimi は低機密・匿名化済みの Level A のみ
- じゅんやさんは最終YESのみ。作業員に戻さない。

## repairLoopPlan

失敗時は自動的にclaudeへ修復ルーティングし、kosameへエスカレーション。critical時はリトライ1回で即エスカレーション。

## 使用方法

```bash
# CLI実行
node tools/practical-dev-factory-runtime-pack.js

# npm scripts
npm run pm-agent:practical-dev-factory-runtime
npm run smoke:practical-dev-factory-runtime-pack

# 環境変数で入力を制御
KOSAME_PROJECT_NAME=my-project \
KOSAME_TASK_GOAL="implement release note generator" \
KOSAME_PRODUCT_LINE=backoffice \
KOSAME_TASK_TYPE=implementation \
KOSAME_RISK_LEVEL=low \
KOSAME_DATA_LEVEL=A \
node tools/practical-dev-factory-runtime-pack.js
```

## 関連ドキュメント

- `docs/ai-dev-team/dev-factory-mvp-v6.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v6.5.0-release-record.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v7.0.0-release-record.md`
