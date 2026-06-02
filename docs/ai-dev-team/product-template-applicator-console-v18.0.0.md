# Product Template Applicator Console v18.0.0

## 目的
商品別テンプレートを選んで、必要なdocs/smoke/tools/runbook候補を生成するpacketを作る。

## 対応商品タイプ
- sales_dx (営業DX)
- anesty_board (ANESTY Board)
- backoffice_agent (BackOffice Agent)
- email_reply_bot (Email Reply BOT)
- cloud_run_pm_agent (Cloud Run PM Agent)

## 各商品のownerRoles
| 商品 | PM | Implementation | Review | Final Approval |
|------|-----|---------------|--------|----------------|
| sales_dx | こさめ/GPT | Claude | Gemini | じゅんやさん |
| anesty_board | こさめ/GPT | Claude | Gemini | じゅんやさん |
| backoffice_agent | こさめ/GPT | Claude | Grok | じゅんやさん |
| email_reply_bot | こさめ/GPT | Claude | Gemini | じゅんやさん |
| cloud_run_pm_agent | こさめ/GPT | Claude | Gemini | じゅんやさん |

## launchChecklist共通項目
- Implementation reviewed by Claude
- Tests passing (npm verify / smoke)
- じゅんやさん final YES (全商品必須)

## 安全ルール
- noRealFileCreation / noRealExecution: true 固定
- このpacket自体は実ファイル作成・commit・push・deployを行わない
