# KOSAME Dev Orchestra v24.0.0 Release Record

## Version
24.0.0

## Title
First Real Product Repo Execution Prompt Pack

## Release Date
2026-06-02

## Summary
v23.0 dispatch plan と v23.5 safety gate review をもとに、Claude Codeへ実プロダクトrepo作業を
投げる直前の実行prompt packを生成する。まだ実repoへは投げない。prompt pack生成のみ。
exportedExecutionPromptには全安全ルールを明記する。

## New Files
- `tools/first-real-product-repo-execution-prompt-pack.js` (v24.0.0)
- `smoke/dev-agent-first-real-product-repo-execution-prompt-pack-smoke.js`
- `fixtures/first-real-product-repo-execution-prompt-pack.sample.json`
- `docs/ai-dev-team/first-real-product-repo-execution-prompt-pack-v24.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v24.0.0-release-record.md`

## New Scripts
- `smoke:first-real-product-repo-execution-prompt-pack`
- `pm-agent:first-real-product-repo-execution-prompt-pack`

## Key Design
- `buildExecutionPromptPack(input)` が実行prompt packを生成
- commandsAllowed: 8種類 (node --check / npm verify / git status 等)
- commandsForbidden: 12種類 (git add/commit/push/tag / deploy / .env等)
- reportFormat: 8フィールド必須 (editedFiles/diffSummary/nodeCheck/verify/smoke/risks/rollback/gitStatus)
- implementationSteps: 9ステップ (最後はSTOP — git add/commitしない)
- promptReady: isKnownProduct && hasTaskScope && hasAllowedFiles && safetyCleared
- handoffToKosame: PROMPT_READY / BLOCKED + actionRequired

## exportedExecutionPrompt 必須安全ルール (CRITICAL SAFETY RULES)
### Git Operations
- git add / commit / push / tag は自動実行しない
- git reset --hard / git clean -f は自動実行しない
- commit candidate で止まって人間YESを待つ

### Secrets & Credentials
- .env / .env.* / secrets/** / credentials/** は読まない
- API key / password / token は echo/log しない

### Customer & Regulated Data
- 顧客PII はコード・prompt・ログに含めない
- 保険証券データ / 健診情報 / 個人名入り議事録は読まない
- モックデータのみ使用

### Deploy & Infrastructure
- deploy / gcloud deploy / docker build / docker push は実行しない
- CI/CD設定は人間レビューなしで変更しない

### General Safety
- humanApprovalRequired: true — 破壊的操作前はSTOPして確認

## Safety
- noRealRepoEdit: true / noRealExecution: true
- safetyGatePassed = false の場合、exportedExecutionPrompt に "# EXECUTION PROMPT BLOCKED" を表示

## package.json version
24.0.0

## Verification
- node --check tools/first-real-product-repo-execution-prompt-pack.js: PASS
- npm run smoke:first-real-product-repo-execution-prompt-pack: PASS
- npm run verify: PASS (接続済み)
