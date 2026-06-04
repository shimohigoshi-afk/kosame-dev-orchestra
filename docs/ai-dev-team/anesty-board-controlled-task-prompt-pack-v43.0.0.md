# ANESTY Board Controlled Task Prompt Pack v43.0.0

## 概要
Claude Code へ投げる controlled prompt を生成するpack。
prompt内に安全ルールをすべて明記し、npm run verify まで実行して commit 候補で停止するよう指示する。

## 役割分担
| 役割 | 担当 |
|---|---|
| Claude | docs / smoke-records / runbook / README 系ファイルの編集・追加のみ担当 |
| Kosame/GPT | PM・安全ゲート・統合判断 / 各ステージ承認 / エスカレーション判断 |
| じゅんやさん | git add / commit / push / tag の最終 YES 担当 |

## 許可ファイル
- docs/ai-dev-team/*.md
- docs/smoke-records/*.md
- docs/runbook/*.md
- docs/pm/*.md
- smoke/README.md

## 禁止ファイル
- bot.js
- BOARD_CANON.js
- .env / .env.*
- secrets/** / credentials/**
- .github/workflows/**
- node_modules/**
- *.log
- package-lock.json

## 許可コマンド
- node --check `<file>`
- npm run verify
- git status --short
- git diff --stat
- git log --oneline -5
- ls / cat / head / tail (read-only inspection)
- find . -name "*.md" (read-only search)

## 禁止コマンド
- git add / git commit / git push / git tag
- git reset --hard / git clean -f / git checkout -- .
- rm -rf
- npm run deploy / docker build / gcloud deploy / gcloud run deploy
- cat .env / cat secrets/** / printenv

## 作業手順 (prompt内指示)
1. git status --short で現在の状態を確認する
2. git log --oneline -5 で最新 commit を確認する
3. docs/ ディレクトリ構造を確認する
4. docs/ai-dev-team/ または docs/smoke-records/ に成功記録 .md を作成する
5. npm run verify を実行して既存テストが壊れていないことを確認する
6. git status --short で変更ファイルを確認する
7. commit 候補として停止する (git add / commit は実行しない)

## commitCandidateStopRule
npm run verify PASS 後、git status --short を確認して停止する。
git add / commit / push は実行しない。じゅんやさんの YES を待つ。

## rollback
追加した docs .md ファイルを削除するだけで revert 完了。
本体ロジックには触れていないため、revert リスクは最小。

## 関連ツール
- `tools/anesty-board-controlled-task-prompt-pack.js` (v43.0.0)
- `smoke/dev-agent-anesty-board-controlled-task-prompt-pack-smoke.js`
- `fixtures/anesty-board-controlled-task-prompt-pack.sample.json`
