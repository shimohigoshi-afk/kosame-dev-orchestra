# KOSAME Dev Orchestra v28.0.0 Release Record

## バージョン
v28.0.0

## リリース日
2026-06-03

## タイトル
First Product Repo Dry Run Dispatch Console

## 概要
v25 Work Order、v25.5 Preflight、v26 Handoff Import、v27 Connection Bridgeを前提に、実repoへ作業を投げる前のdry-run dispatch packetを生成するpackを追加した。

## 追加ファイル
- `tools/first-product-repo-dry-run-dispatch-console-pack.js`
- `smoke/dev-agent-first-product-repo-dry-run-dispatch-console-smoke.js`
- `fixtures/first-product-repo-dry-run-dispatch-console.sample.json`
- `docs/ai-dev-team/first-product-repo-dry-run-dispatch-console-v28.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v28.0.0-release-record.md`

## 主要機能
- dryRunDispatchId 生成
- workOrderSummary / connectionBridgeSummary / preflightSummary / executionPromptSummary 入力管理
- dryRunSteps (10ステップ: Human + Claude の役割分担)
- expectedClaudeActions / expectedHumanActions
- allowedActions / blockedActions
- verificationPlan (nodeCheck / smokeTest / fileZoneCheck / noSecretCheck / gitStatusCheck / humanReview)
- rollbackPlan (preDispatch / postDispatch / forbidden)
- dispatchDryRunReady / notReadyReasons / recommendedNextAction
- dangerousActionsDenied

## 安全ルール
- dryRun: true
- humanApprovalRequired: true
- noRealRepoEdit / noRealGitCommit / noRealGitPush / noRealDeploy / noRealSecretRead: true
- 実Claude実行禁止 / 実repo編集禁止 / 実コマンド実行禁止

## dispatchDryRunReady 条件
- isKnownProduct: true
- workOrderSummary あり
- connectionBridgeSummary あり (v27 bridge)
- preflightSummary あり (v25.5 preflight)

## 前バージョン
v27.0.0 — First Real Product Repo Connection Bridge

## 次バージョン候補
v29.0.0 — First Product Repo Result Review Console
