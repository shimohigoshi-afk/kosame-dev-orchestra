# KOSAME Dev Orchestra v16.0.0 Release Record

## Version
16.0.0

## Title
Commit Candidate Packet Builder

## Release Date
2026-06-02

## Summary
意図ファイル限定add、staged files、diff stat、commit message候補、tag候補、push前確認、
Actions確認手順、rollback noteをまとめた commit candidate packet を生成する。
ただし実commit / push / tagは絶対に実行しない。

## New Files
- `tools/commit-candidate-packet-builder-pack.js` (v16.0.0)
- `smoke/dev-agent-commit-candidate-packet-builder-smoke.js`
- `fixtures/commit-candidate-packet-builder.sample.json`
- `docs/ai-dev-team/commit-candidate-packet-builder-v16.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v16.0.0-release-record.md`

## New Scripts
- `smoke:commit-candidate-packet-builder`
- `pm-agent:commit-candidate-packet-builder`

## Key Design
- `buildCommitCandidatePacket(input)` がcommit候補packetを生成
- `intendedFiles`: 意図した追加ファイルのみ (denied fileチェック付き)
- `deniedFiles`: .env / .env.* / secrets/** など
- `stagedFilesPreview`: dry-run形式のstaged files一覧 (実際にはgit addしない)
- `diffStatPreview`: dry-run形式のdiff stat (実際にはgit diffしない)
- `commitMessageCandidate`: version + taskGoal + 対象ファイルで自動生成
- `tagCandidate`: `v${version}` 形式
- `prePushChecklist`: 8項目のpush前確認リスト
- `githubActionsChecklist`: 5項目のCI確認リスト
- `isDeniedFileIncluded`: intendedFilesにdenied fileが混入していないか
- `readyForHumanReview`: verifyPassed && nodeCheckPassed && !isDeniedFileIncluded

## 必須包含フィールド
- intendedFiles
- deniedFiles
- stagedFilesPreview
- diffStatPreview
- commitMessageCandidate
- tagCandidate
- prePushChecklist
- githubActionsChecklist
- rollbackNote
- humanApprovalRequired (true 固定)
- dangerousActionsDenied
- absolutelyForbidden

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- git add / git commit / git push / git tag は絶対に実行しない
- absolutelyForbidden リストに明示記載
- じゅんやさんの明示的YESが必要

## package.json version
16.0.0

## Verification
- node --check tools/commit-candidate-packet-builder-pack.js: PASS
- npm run smoke:commit-candidate-packet-builder: PASS
- npm run verify: PASS (接続済み)
