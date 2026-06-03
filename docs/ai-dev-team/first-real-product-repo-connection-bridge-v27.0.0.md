# First Real Product Repo Connection Bridge (v27.0.0)

## 目的
実プロダクトrepoへ接続する前提情報を整理し、KOSAME Dev Orchestra側で安全にConnection Bridgeを準備する。
実repoの存在確認・ファイル読取・Secret読取は行わない。dry-run connection bridgeのみ生成する。

## 対象プロダクト
| product | repoCanidate | repoKind |
|---------|-------------|----------|
| sales_dx | kosame-sales-dx | nodejs_webapp |
| anesty_board | kosame-anesty-board | nodejs_nextjs |
| backoffice_agent | kosame-backoffice-agent | nodejs_api |
| email_reply_bot | kosame-email-reply-bot | nodejs_cloud_function |
| cloud_run_pm_agent | kosame-dev-orchestra | nodejs_orchestrator |

## 出力フィールド
- connectionBridgeId
- targetProduct
- targetRepoCandidate
- repoPathCandidate
- repoKind
- branchPolicy
- connectionAssumptions
- safeReadOnlyChecks
- forbiddenChecks
- requiredHumanInputs
- missingHumanInputs
- secretBoundary
- customerDataBoundary
- regulatedDataBoundary
- allowedConnectionMode
- blockedConnectionModes
- humanApprovalRequired
- dangerousActionsDenied
- connectionBridgeReady
- notReadyReasons
- recommendedNextAction

## connectionBridgeReady 条件
- isKnownProduct: true
- missingHumanInputs: []（全4入力が揃っていること）

## 必須Human Inputs
1. repoExistsConfirmed
2. branchNameForWork
3. taskScopeConfirmed
4. allowedFileZonesConfirmed

## 安全境界
- allowedConnectionMode: dry_run_readonly_bridge_only
- blockedConnectionModes: direct_deploy / auto_push / auto_tag / secret_inspection / customer_data_scan / destructive_cleanup
- noRealRepoAccess: true
- noRealSecretRead: true
- noRealCommit / noRealPush / noRealDeploy: true

## 使用方法
```bash
node tools/first-real-product-repo-connection-bridge-pack.js
npm run pm-agent:first-real-product-repo-connection-bridge
npm run smoke:first-real-product-repo-connection-bridge
```

## 次ステップ
connectionBridgeReady = true の場合、v28 Dry Run Dispatch Console へ進む。
