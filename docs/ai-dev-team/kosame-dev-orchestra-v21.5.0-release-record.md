# KOSAME Dev Orchestra v21.5.0 Release Record

## Version
21.5.0

## Title
Product Repo Connection Prep Pack

## Release Date
2026-06-02

## Summary
実プロダクトrepoへ作業を流す前に、repo情報・触ってよい領域・触ってはいけない領域・
検証コマンド・承認ゲートを整理する接続準備packetを生成する。
実際の外部repo存在確認コマンドは実行しない。あくまでdry-run packetとして確認計画を出す。

## New Files
- `tools/product-repo-connection-prep-pack.js` (v21.5.0)
- `smoke/dev-agent-product-repo-connection-prep-smoke.js`
- `fixtures/product-repo-connection-prep.sample.json`
- `docs/ai-dev-team/product-repo-connection-prep-pack-v21.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v21.5.0-release-record.md`

## New Scripts
- `smoke:product-repo-connection-prep`
- `pm-agent:product-repo-connection-prep`

## Key Design
- `buildConnectionPrepPacket(input)` が接続準備packetを生成
- repoExistenceCheckPlan: dry-run only — 実コマンドは実行しない（note明記）
- branchPolicy: defaultBranch / workBranch / requiresPR
- safeReadCommands: git status / log / diff / ls / cat README / node --check
- safeWriteZones / deniedZones: 商品別に定義
- secretAndEnvPolicy / customerDataPolicy: 商品別
- humanApprovalGates: 4段階 (こさめ PM → Claude impl → こさめ diff review → じゅんやさん final YES)
- connectionReady: isKnownProduct && notReadyReasons.length === 0

## Safety
- noRealRepoAccess: true / noRealExecution: true
- dangerousActionsDenied 13種類
- repoExistenceCheckPlan は dry-run only と明記

## package.json version
21.5.0

## Verification
- node --check tools/product-repo-connection-prep-pack.js: PASS
- npm run smoke:product-repo-connection-prep: PASS
- npm run verify: PASS (接続済み)
