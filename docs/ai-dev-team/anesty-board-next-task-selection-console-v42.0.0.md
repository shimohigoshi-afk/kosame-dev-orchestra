# ANESTY Board Next Task Selection Console v42.0.0

## 概要
ANESTY Board への次タスク候補を低リスク優先で選択するコンソール。
bot.js / BOARD_CANON.js / deploy / Secret 等をhold対象とし、docs / smoke / runbook 系のみを候補として提示する。

## タスク候補一覧

| taskId | taskTitle | implementationRisk | safetyRisk | recommended |
|---|---|---|---|---|
| task_docs_pm_ops | docs/pm 運用整理 | very_low | very_low | false |
| task_v87_success_docs | v87.0.8 成功記録 docs 追加 | very_low | very_low | **true** |
| task_smoke_routing_readme | smoke-dev-agent-routing の README 化 | very_low | very_low | false |
| task_cloudrun_preflight_docs | Cloud Run preflight docs 補強 | low | very_low | false |
| task_runbook_no_bot | runbook 整備 (bot.js 不使用) | very_low | very_low | false |

## 推薦タスク
**task_v87_success_docs — v87.0.8 成功記録 docs 追加**

推薦理由:
1. 既に実施済みの smoke テスト結果を文書化するだけであり、コードへの変更がない
2. 対象ファイルは docs/ai-dev-team または docs/smoke-records 以下の .md ファイルのみ
3. bot.js / BOARD_CANON.js / .env / secrets には一切触れない
4. 低リスク初回タスクとして最適 — 失敗しても revert は docs ファイルを削除するだけ

## 許可スコープ
- docs/**/*.md
- smoke/README.md
- docs/smoke-records/*.md
- docs/ai-dev-team/*.md
- docs/runbook/*.md
- docs/pm/*.md

## Hold対象 (禁止スコープ)
- bot.js — Discord 本体ロジック
- BOARD_CANON.js — ボード正規化ロジック
- .env / secrets / .env.* / credentials — Secret 類
- API key / Secret Manager 値の読取
- .github/workflows — CI/CD 設定
- deploy / docker build / gcloud deploy
- git add / git commit / git push / git tag
- 顧客情報 / 保険証券 / 健診情報 / 個人名入り議事録
- rm -rf / git reset --hard / git clean -f

## 次のアクション
- v43: ANESTY Board Controlled Task Prompt Pack — Claude Code へ投げる controlled prompt を生成する
- v44: ANESTY Board First Controlled Task Trial Pack — 初回 controlled task の trial ready 判定を生成する
- その後: じゅんやさん YES のもと ANESTY Board への実タスク投入を開始する

## 関連ツール
- `tools/anesty-board-next-task-selection-console-pack.js` (v42.0.0)
- `smoke/dev-agent-anesty-board-next-task-selection-console-smoke.js`
- `fixtures/anesty-board-next-task-selection-console.sample.json`
