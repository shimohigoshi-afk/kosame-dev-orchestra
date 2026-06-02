# KOSAME Dev Orchestra v13.5.0 Release Record

## Version
13.5.0

## Title
Dry Run Result Review Console

## Release Date
2026-06-01

## Summary
v13.0.0 First End-to-End Dry Run Console の結果を読み込み、
じゅんやさんが「何が生成されたか」「何を実行予定か」「どこが危険か」「次に承認すべきか」を
一目で判断できる review packet に圧縮するコンソールを実装した。

## New Files
- `tools/dry-run-result-review-console-pack.js` (v13.5.0)
- `smoke/dev-agent-dry-run-result-review-console-pack-smoke.js`
- `fixtures/dry-run-result-review-console.sample.json`
- `docs/ai-dev-team/dry-run-result-review-console-v13.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v13.5.0-release-record.md`

## New Scripts
- `smoke:dry-run-result-review-console-pack`
- `pm-agent:dry-run-result-review-console`

## Key Design
- `dryRunConsolePacket` (v13.0.0の出力) を受け取り、review packetに圧縮
- または individual input fields (projectName / taskGoal / targetFiles ...) からも動作可
- `generatedPacketSummary`: v13.0.0 output の各packetの有無
- `providerRoleSummary`: 5プロバイダーの役割と repo 編集権限の要約
- `fileTouchSummary`: targetFiles の危険性チェック (DANGEROUS_FILE_PATTERNS)
- `safetyReview`: riskLevel / dataLevel / 危険ファイル / secrets の安全審査
- `approvalReadiness`: human review への準備状態
- `reviewerDecisionOptions`: approve / revise / reject / hold
- `reviewPassed`: safetyReview.safetyPassed && unresolvedItems.length === 0

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- noRealApiExecution: true / noRealFileEdit: true
- .env / Secret / API key / customer data は危険扱い
- Gemini/Grok は repo 編集不可
- blockedDangerousActions: git push / git tag / deploy / gcloud deploy / docker build / secret / .env / api key / customer data / destructive action / rm -rf

## Verification
- node --check tools/dry-run-result-review-console-pack.js: PASS
- npm run smoke:dry-run-result-review-console-pack: PASS
- npm run verify: PASS (接続済み)
