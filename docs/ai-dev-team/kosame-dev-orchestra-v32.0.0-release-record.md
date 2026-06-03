# KOSAME Dev Orchestra v32.0.0 Release Record

## バージョン
v32.0.0

## リリース日
2026-06-03

## タイトル
First Product Repo Selection Console

## 概要
営業DX / ANESTY / BackOffice / Email Reply BOT / Cloud Run PM Agent の中から、最初に投入する実プロダクトrepo候補を選定する console packetを生成するpackを追加した。

## 追加ファイル
- `tools/first-product-repo-selection-console-pack.js`
- `smoke/dev-agent-first-product-repo-selection-console-smoke.js`
- `fixtures/first-product-repo-selection-console.sample.json`
- `docs/ai-dev-team/first-product-repo-selection-console-v32.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v32.0.0-release-record.md`

## 主要機能
- repoSelectionId 生成
- 5プロダクトのリスク・適性スコアリング (firstTouchSuitability: high/medium/low)
- recommendedFirstProduct (最高スコアを自動推奨)
- holdProducts (初回投入候補としてhold推奨のプロダクト一覧)
- selectionReason / businessImpact / implementationRisk / safetyRisk
- requiredHumanInputs / missingInputs
- decisionOptions: approve / revise / reject / hold

## 推奨方針
- 初回投入は「低リスク・成果が見えやすい・Secret不要・本番影響なし」のrepoを優先
- ANESTY Board: 保険・健診情報あり → hold
- BackOffice: Secret必要・本番影響あり → hold (docs限定なら条件付き可)
- Email Reply BOT / 営業DX: 低リスク → 推奨

## 安全ルール
- dryRun: true
- humanApprovalRequired: true
- 実repoアクセス禁止

## 前バージョン
v31.0.0 — GitHub Actions Node24 Readiness Pack

## 次バージョン候補
v33.0.0 — Product Repo First Touch Dry Run Pack
