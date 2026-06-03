# KOSAME Dev Orchestra v34.0.0 Release Record

## バージョン
v34.0.0

## リリース日
2026-06-03

## タイトル
Product Repo First Controlled Task Launch Pack

## 概要
初回商品repo作業をClaude Codeへ渡すための controlled launch packet を生成するpackを追加した。
実repoへは投げない。launch packet (claudePromptToLaunch) 生成のみ。

## 追加ファイル
- `tools/product-repo-first-controlled-task-launch-pack.js`
- `smoke/dev-agent-product-repo-first-controlled-task-launch-pack-smoke.js`
- `fixtures/product-repo-first-controlled-task-launch.sample.json`
- `docs/ai-dev-team/product-repo-first-controlled-task-launch-pack-v34.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v34.0.0-release-record.md`

## 主要機能
- controlledLaunchId 生成
- claudePromptToLaunch: Claude Code に直接貼れる形式のプロンプト生成
  - 許可ファイルゾーン・禁止ファイルゾーン明示
  - git commit / push / tag 禁止明記
  - deploy / Secret読取 / 本番影響禁止明記
  - handoffレポートフォーマット指定
- preLaunchChecklist (7項目)
- postLaunchReportFormat (requiredFields / forbiddenFields)
- commitStopRule (5ルール)
- rollbackInstruction
- launchReady / blockedReasons / recommendedNextAction

## launchReady 条件
- isKnownProduct: true
- preLaunchConfirmed: true

## 安全ルール
- dryRun: true
- humanApprovalRequired: true
- noRealCommit / noRealPush / noRealTag / noRealDeploy / noSecretRead: true
- 初回タスクは docs / smoke / runbook / README など低リスク対象に限定

## 前バージョン
v33.0.0 — Product Repo First Touch Dry Run Pack

## 次バージョン候補
v35.0.0 — First Product Repo Operation Readiness Complete
