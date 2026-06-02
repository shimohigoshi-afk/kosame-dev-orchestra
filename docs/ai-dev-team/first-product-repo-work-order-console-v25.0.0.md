# First Product Repo Work Order Console v25.0.0

## 目的
実プロダクトrepoへ渡す「作業指示書」を生成する。
Claude Codeへ渡せる実務寄りのwork orderとして整備する。

## 商品別 productContext
- sales_dx: リードPIIはコード・ログ・promptに含めない
- anesty_board: 被保険者PII・保険証券データ・健診情報は絶対に含めない
- backoffice_agent: 従業員PII・給与・内部財務データは含めない
- email_reply_bot: 実メールアドレス・個人名はコード・テンプレートに含めない
- cloud_run_pm_agent: GCPキー・Secret Manager値・顧客データは含めない

## commandsAllowed (8種類)
- node --check / npm run verify / npm test (non-destructive)
- git status / git diff / git log / ls -la / cat README.md

## commandsForbidden (12種類)
- git add/commit/push/tag (without じゅんやさん YES)
- git reset --hard / git clean -f
- rm -rf / deploy / gcloud deploy / docker build / docker push
- cat .env / secrets / node -e / production writes

## reportFormat 必須フィールド (8種)
editedFiles / diffSummary / nodeCheckResult / verifyResult / smokeResult / remainingRisks / rollbackNote / gitStatusOutput

## reportFormat instruction
"Stop at commit candidate. Return JSON report. Do NOT git add / commit / push without explicit じゅんやさん YES."

## 安全ルール
- dryRun: true / humanApprovalRequired: true 固定
- noRealRepoEdit / noRealExecution: true 固定
