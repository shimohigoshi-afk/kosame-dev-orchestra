# KOSAME Dev Orchestra v42.0.0 Release Record

## バージョン
v42.0.0

## リリース日
2026-06-04

## タイトル
ANESTY Board Next Task Selection Console Pack

## 概要
ANESTY Board への次タスク候補を低リスク優先で選択するコンソールpackを追加した。
bot.js / BOARD_CANON.js / deploy / Secret / .env / Discord本番挙動はすべてhold対象とし、
docs / tickets / smoke / README など安全な範囲のタスクのみを候補として提示する。

## 追加ファイル
- `tools/anesty-board-next-task-selection-console-pack.js`
- `smoke/dev-agent-anesty-board-next-task-selection-console-smoke.js`
- `fixtures/anesty-board-next-task-selection-console.sample.json`
- `docs/ai-dev-team/anesty-board-next-task-selection-console-v42.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v42.0.0-release-record.md`

## 主要機能
- anestyNextTaskSelectionId 生成
- candidateTasks (5候補: docs/pm運用整理 / v87成功記録 / smoke README化 / Cloud Run preflight docs / runbook整備)
- recommendedTask (v87.0.8 成功記録 docs 追加 — lowest risk)
- selectionReason (推薦理由 4点)
- allowedScope (docs/**/*.md / smoke/README.md)
- forbiddenScope (bot.js / BOARD_CANON.js / .env / deploy / git push 等)
- requiredInputs / missingInputs
- dangerousActionsDenied / providerRoleMap

## 推薦タスク
- taskId: task_v87_success_docs
- taskTitle: v87.0.8 成功記録 docs 追加
- implementationRisk: very_low / safetyRisk: very_low / businessImpact: low

## Hold対象 (絶対触らない)
- bot.js / BOARD_CANON.js
- deploy / docker build / gcloud deploy
- Secret / .env / API key
- .github/workflows
- Discord本番挙動

## 安全ルール
- dryRun: true / humanApprovalRequired: true
- allowedScope は docs/**/*.md と smoke/README.md のみ

## 前バージョン
v41.0.0 — First Real Repo Trial Success Record Pack

## 次フェーズ
v43.0.0 — ANESTY Board Controlled Task Prompt Pack
