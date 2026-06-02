# First Product Repo Task Packet v21.0.0

## 目的
じゅんやさんが作業要求を伝えたときに、初回の実プロダクトrepo向け作業依頼packetを生成する。

## 対応商品タイプ
| productType | targetRepoCandidate |
|------------|---------------------|
| sales_dx | kosame-sales-dx |
| anesty_board | kosame-anesty-board |
| backoffice_agent | kosame-backoffice-agent |
| email_reply_bot | kosame-email-reply-bot |
| cloud_run_pm_agent | kosame-dev-orchestra |

## 商品別 dataBoundary
- sales_dx: リードPII (name/email/phone) はコードやpromptに含めない
- anesty_board: 被保険者/患者PII・健康診断データ・保険金額は絶対に含めない
- backoffice_agent: 従業員PII・給与・内部財務データは含めない
- email_reply_bot: 実メールアドレス・個人名はコードやテンプレートに含めない
- cloud_run_pm_agent: 顧客データは一切含めない

## claudeTaskDraft の構成
1. Role (商品タイプ)
2. Task Goal
3. Allowed File Zones
4. Denied File Zones
5. Forbidden Actions
6. Safety Rules

## 安全ルール
- dryRun: true / humanApprovalRequired: true 固定
- noRealRepoEdit / noRealExecution: true 固定
- dangerousActionsDenied に 18 種類の禁止アクション
