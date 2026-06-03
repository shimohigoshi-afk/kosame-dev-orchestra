# GitHub Actions Node24 Readiness Pack (v31.0.0)

## 目的
GitHub Actionsで Node.js 20 actions deprecated 警告が出ているため、Node24移行に向けた readiness packetを生成する。
.github/workflows の実編集はしない。実push/tagはしない。readiness packetのみ生成する。

## 対象ワークフロー
- `.github/workflows/verify.yml` (node-version: "20" → "24" への変更候補)
- `.github/workflows/pm-agent-launch-readiness.yml`

## 出力フィールド
- node24ReadinessId
- currentWarningSummary
- affectedActions
- targetNodeVersion
- workflowFilesCandidate
- readinessChecklist
- safeInspectionCommands
- forbiddenActions
- migrationPlan
- rollbackPlan
- humanApprovalRequired
- node24ReadinessPassed
- blockerItems
- recommendedNextAction

## node24ReadinessPassed 条件
- blockerItems: [] (localVerifyFailed / nodeCheckFailed / humanReviewPending がいずれもfalse)

## migrationPlan 概要
1. .github/workflows/*.yml を read-only 確認
2. Node 24 で node --check ローカル実行
3. Node 24 で npm run verify ローカル実行
4. workflow diff 草案生成 (Claude draft only, no edit)
5. こさめ/GPT PM が draft をレビュー
6. じゅんやさん YES 後 .github/workflows/*.yml を編集
7. git add / commit / push (Human実行)
8. GitHub Actions CI が Node 24 で PASS することを確認

## 安全境界
- noWorkflowEdit: true
- noRealPush: true
- noRealTag: true
- noRealDeploy: true

## 使用方法
```bash
node tools/github-actions-node24-readiness-pack.js
npm run pm-agent:github-actions-node24-readiness-pack
npm run smoke:github-actions-node24-readiness-pack
```
