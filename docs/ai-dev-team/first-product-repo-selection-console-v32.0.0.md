# First Product Repo Selection Console (v32.0.0)

## 目的
5つの商品repoの中から、最初に投入する実プロダクトrepo候補を選定する。
「低リスク・成果が見えやすい・Secret不要・本番影響なし」のrepoを優先する方針。

## プロダクト適性スコア

| product | firstTouchSuitability | safetyRisk | secretRequired | regulatedData |
|---------|----------------------|------------|----------------|---------------|
| sales_dx | high | low | false | false |
| email_reply_bot | high | low | false | false |
| cloud_run_pm_agent | medium | low | false | false |
| backoffice_agent | low | medium | true | false |
| anesty_board | low | high | true | true |

## holdProducts
- anesty_board: 保険・健診情報を扱う規制データあり。Secret必須・本番影響大。
- backoffice_agent: Secret必要・本番影響あり。docs/runbook限定なら条件付き可。

## 出力フィールド
- repoSelectionId
- productCandidates (5プロダクト、スコア順)
- recommendedFirstProduct
- selectionReason
- businessImpact / implementationRisk / safetyRisk
- holdProducts
- repoReadinessAssumption
- requiredHumanInputs
- missingInputs
- decisionOptions
- humanApprovalRequired
- recommendedNextAction

## requiredHumanInputs
1. selectedProduct
2. businessPriorityConfirmed
3. firstTaskScopeConfirmed

## 安全境界
- noRealRepoAccess: true
- noRealCommit / noRealDeploy: true

## 使用方法
```bash
node tools/first-product-repo-selection-console-pack.js
npm run pm-agent:first-product-repo-selection-console
npm run smoke:first-product-repo-selection-console
```

## 次ステップ
選定完了後、v33 Product Repo First Touch Dry Run Pack へ進む。
