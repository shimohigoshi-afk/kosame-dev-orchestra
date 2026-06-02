# KOSAME Dev Orchestra v25.5.0 Release Record

## Version
25.5.0

## Title
External Repo Preflight Command Pack

## Release Date
2026-06-02

## Summary
実プロダクトrepoへClaude作業を投げる前に、人間がCloud Shell / PowerShellで確認する
preflight command packを生成する。実行はしない。コマンド候補をpacketとして出力するだけ。
bash / powershell / cloud_shell の3シェルタイプに対応。

## New Files
- `tools/external-repo-preflight-command-pack.js` (v25.5.0)
- `smoke/dev-agent-external-repo-preflight-command-pack-smoke.js`
- `fixtures/external-repo-preflight-command-pack.sample.json`
- `docs/ai-dev-team/external-repo-preflight-command-pack-v25.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v25.5.0-release-record.md`

## New Scripts
- `smoke:external-repo-preflight-command-pack`
- `pm-agent:external-repo-preflight-command-pack`

## Key Design
- `buildPreflightPack(input)` が preflight command pack を生成
- shellType: bash / powershell / cloud_shell (コマンド形式が変わる)
- safeReadCommands: ls / git status / git log / git branch / node --version / npm --version 等
- forbiddenCommands: rm -rf / git reset --hard / deploy / docker / gcloud / .env読取 等 12種類
- repoCleanCheck / branchCheck / packageVersionCheck / dependencyCheck / verifyCommandCandidate
- gitSafetyCheck: safeOps / unsafeOps を明示
- secretSafetyCheck: 商品別の確認項目
- backupRecommendation: git stash / baseline記録 / rollback準備

## Safety
- noRealCommandExecution: true / noRealRepoAccess: true 固定
- 全checkは dry-run only とnoteに明記
- 実行はじゅんやさんYES後に人間が行う

## package.json version
25.5.0

## Verification
- node --check tools/external-repo-preflight-command-pack.js: PASS
- npm run smoke:external-repo-preflight-command-pack: PASS
- npm run verify: PASS (接続済み)
