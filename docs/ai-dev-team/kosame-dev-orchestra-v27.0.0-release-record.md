# KOSAME Dev Orchestra v27.0.0 Release Record

## バージョン
v27.0.0

## リリース日
2026-06-03

## タイトル
First Real Product Repo Connection Bridge

## 概要
実プロダクトrepoへ接続する前提情報を整理し、KOSAME Dev Orchestra側で安全に接続準備できるConnection Bridge packetを生成するpackを追加した。

## 追加ファイル
- `tools/first-real-product-repo-connection-bridge-pack.js`
- `smoke/dev-agent-first-real-product-repo-connection-bridge-smoke.js`
- `fixtures/first-real-product-repo-connection-bridge.sample.json`
- `docs/ai-dev-team/first-real-product-repo-connection-bridge-v27.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v27.0.0-release-record.md`

## 主要機能
- connectionBridgeId 生成
- 対象5プロダクト (sales_dx / anesty_board / backoffice_agent / email_reply_bot / cloud_run_pm_agent) の repo候補・path候補・repoKind・branchPolicy を自動設定
- safeReadOnlyChecks / forbiddenChecks 定義
- requiredHumanInputs / missingHumanInputs 管理
- secretBoundary / customerDataBoundary / regulatedDataBoundary 強制
- allowedConnectionMode: dry_run_readonly_bridge_only
- blockedConnectionModes: direct_deploy / auto_push / auto_tag / secret_inspection / customer_data_scan / destructive_cleanup
- connectionBridgeReady / notReadyReasons / recommendedNextAction 出力

## 安全ルール
- dryRun: true
- humanApprovalRequired: true
- 実repoアクセス禁止
- Secret / .env / API key 読取禁止
- 実commit / push / tag / deploy 禁止

## 対応プロダクト
sales_dx / anesty_board / backoffice_agent / email_reply_bot / cloud_run_pm_agent

## 前バージョン
v26.0.0 — First Product Repo Work Order, Preflight, and Handoff Import Pack

## 次バージョン候補
v28.0.0 — First Product Repo Dry Run Dispatch Console
