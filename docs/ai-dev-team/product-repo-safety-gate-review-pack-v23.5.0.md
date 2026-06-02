# Product Repo Safety Gate Review Pack v23.5.0

## 目的
実プロダクトrepoへ作業を流す前に、危険操作・Secret境界・顧客情報境界・
保険/健診/個人情報境界・deploy/commit/push/tagの承認条件をレビューする。

## safetyChecklist (13項目)
1. dryRun is true
2. humanApprovalRequired
3. targetProduct is known
4. secret boundary defined
5. customer data boundary defined
6. regulated data boundary reviewed
7. deploy risk acknowledged
8. git ops require human YES
9. no auto-deploy
10. dangerousActionsDenied present
11. allowedFileZones present
12. deniedFileZones present
13. rollbackPlan present

## 商品別 deployRiskReview
| 商品 | riskLevel |
|------|-----------|
| sales_dx | medium |
| anesty_board | **high** (保険/健康データ) |
| backoffice_agent | **high** (財務/HR) |
| email_reply_bot | medium |
| cloud_run_pm_agent | low |

## 商品別 regulatedDataBoundaryReview
- anesty_board: applicable: true (保険証券/健診情報/患者PII)
- backoffice_agent: applicable: true (従業員給与/HR記録/内部財務)
- その他: applicable: false

## finalDecision ロジック
- blockers > 3 → reject
- blockers > 0 → hold
- deployRisk = high → hold
- それ以外 → approve

## humanApprovalGates (4段階)
1. こさめ/GPT PM: task scope and safety review before dispatch
2. Claude: implementation + node --check before staging
3. こさめ/GPT PM: diff review before commit
4. じゅんやさん: explicit final YES before git add / commit / push / tag / deploy

## 安全ルール
- Secret / .env / API key は読まない (固定)
- 顧客情報・保険証券・健診情報・個人名入り議事録は読まない (固定)
- noRealRepoAccess / noRealExecution: true 固定
