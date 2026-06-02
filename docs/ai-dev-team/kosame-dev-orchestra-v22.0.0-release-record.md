# KOSAME Dev Orchestra v22.0.0 Release Record

## Version
22.0.0

## Title
First Product Repo Claude Prompt Exporter

## Release Date
2026-06-02

## Summary
v21.0 / v21.5 のpacketをもとに、Claude Codeへ実プロダクトrepo作業を投げるための
安全promptを生成する。まだ実repoには投げない。prompt exportのみ。
exportedPrompt内に実commit/push/tag/deploy禁止・Secret読取禁止・
実repo作業前の人間承認必須を明記する。

## New Files
- `tools/first-product-repo-claude-prompt-exporter-pack.js` (v22.0.0)
- `smoke/dev-agent-first-product-repo-claude-prompt-exporter-smoke.js`
- `fixtures/first-product-repo-claude-prompt-exporter.sample.json`
- `docs/ai-dev-team/first-product-repo-claude-prompt-exporter-v22.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v22.0.0-release-record.md`

## New Scripts
- `smoke:first-product-repo-claude-prompt-exporter`
- `pm-agent:first-product-repo-claude-prompt-exporter`

## Key Design
- `buildPromptExporter(input)` が安全exportedPromptを生成
- claudeRole: 商品別Claude実装担当ロール定義
- exportedPrompt: Claude Codeへ貼れる構造化prompt文字列
  - Target Repo / Task Scope / Files Allowed / Files Forbidden
  - Implementation Steps / Verification Commands / Data/Secret Boundary
  - Forbidden Actions (15種類) / Rollback Instruction
  - Critical Safety Rules (git ops禁止・secret禁止・deploy禁止・humanApproval必須)
- promptReady: isKnownProduct && hasTaskScope && hasAllowedFiles
- promptBlockedReasons: ブロック理由一覧
- blocked case: exportedPrompt に "# BLOCKED" を表示

## exportedPrompt 必須記載事項
- git add / commit / push / tag は自動実行しない
- じゅんやさん explicit YES なしに実行しない
- .env / secrets / API key は読まない
- deploy / docker build / gcloud deploy は実行しない
- humanApprovalRequired: true

## Safety
- noRealRepoEdit: true / noRealExecution: true 固定
- forbiddenActions: 15種類明示

## package.json version
22.0.0

## Verification
- node --check tools/first-product-repo-claude-prompt-exporter-pack.js: PASS
- npm run smoke:first-product-repo-claude-prompt-exporter: PASS
- npm run verify: PASS (接続済み)
