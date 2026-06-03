# KOSAME Dev Orchestra v39.0.0 Release Record

## バージョン
v39.0.0

## リリース日
2026-06-03

## タイトル
KOSAME Dev Orchestra Operating Manual Pack

## 概要
KOSAME Dev Orchestraの使い方、役割分担、安全境界、作業フロー、実repo投入手順をまとめた運用manual packetを生成するpackを追加した。

## 追加ファイル
- `tools/kosame-dev-orchestra-operating-manual-pack.js`
- `smoke/dev-agent-kosame-dev-orchestra-operating-manual-pack-smoke.js`
- `fixtures/kosame-dev-orchestra-operating-manual.sample.json`
- `docs/ai-dev-team/kosame-dev-orchestra-operating-manual-pack-v39.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v39.0.0-release-record.md`

## 主要機能
- operatingManualId 生成
- overview (safetyFirst / noAutoOps)
- providerRoleMap: じゅんやさん / Kosame/GPT / Claude / Gemini / Grok / DeepSeek / Kimi / Cloud Shell
- standardOperationFlow (15ステップ)
- versionMilestones (v1–v40 概略)
- humanApprovalGates
- safeCommandPolicy (alwaysAllowed / requiresHumanYes / alwaysBlocked)
- firstProductRepoTaskProcedure / resultImportProcedure / commitCandidateProcedure / rollbackProcedure
- troubleshootingNotes / nextVersionCandidates
- manualReady: true

## 前バージョン
v38.0.0 — First Real Product Repo Result Acceptance Gate

## 次バージョン候補
v40.0.0 — KOSAME Dev Orchestra Initial Completion Pack
