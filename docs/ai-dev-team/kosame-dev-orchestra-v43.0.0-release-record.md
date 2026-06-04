# KOSAME Dev Orchestra v43.0.0 Release Record

## バージョン
v43.0.0

## リリース日
2026-06-04

## タイトル
ANESTY Board Controlled Task Prompt Pack

## 概要
Claude Code へ投げる controlled prompt を生成するpackを追加した。
promptには必ず安全ルール (git add/commit/push/tag禁止 / deploy禁止 / Secret読取禁止 / bot.js触禁止) を明記し、
npm run verify まで実行して commit候補で止めるよう指示する。

## 追加ファイル
- `tools/anesty-board-controlled-task-prompt-pack.js`
- `smoke/dev-agent-anesty-board-controlled-task-prompt-pack-smoke.js`
- `fixtures/anesty-board-controlled-task-prompt-pack.sample.json`
- `docs/ai-dev-team/anesty-board-controlled-task-prompt-pack-v43.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v43.0.0-release-record.md`

## 主要機能
- anestyControlledPromptPackId 生成
- claudeRole / kosameRole / humanRole (役割分担明記)
- allowedFiles (docs/**/*.md / smoke/README.md のみ)
- forbiddenFiles (bot.js / BOARD_CANON.js / .env / secrets / .github/workflows 等)
- allowedCommands (node --check / npm run verify / git status --short 等)
- forbiddenCommands (git add/commit/push/tag / rm -rf / deploy / cat .env 等)
- preflightCommands / verificationCommands / reportFormat / rollbackInstruction
- implementationPrompt (安全ルール完全内包)
- commitCandidateStopRule (git add前に停止)
- promptReady / blockerItems

## prompt内安全ルール (必須明記)
- git add / commit / push / tag 禁止
- deploy / docker build / gcloud deploy 禁止
- Secret / .env / API key 読取禁止
- bot.js / BOARD_CANON.js 触禁止
- 顧客情報読取禁止
- npm run verify まで実行
- commit候補で止める

## 安全ルール
- dryRun: true / humanApprovalRequired: true
- allowedFiles は docs/README 系のみ
- promptReady = false when blockerItems が存在

## 前バージョン
v42.0.0 — ANESTY Board Next Task Selection Console Pack

## 次フェーズ
v44.0.0 — ANESTY Board First Controlled Task Trial Pack
