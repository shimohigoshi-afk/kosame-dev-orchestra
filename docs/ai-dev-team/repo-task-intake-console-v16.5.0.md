# Repo Task Intake Console v16.5.0

## 目的
じゅんやさんが作業要求を口頭/テキストで伝えたときに、intake packetに正規化する。
対象商品判定・riskLevel・dataLevel・rejectedIfIncludesSecrets・recommendedNextActionを整理する。

## 入力フィールド
| フィールド | 必須 | 説明 |
|-----------|------|------|
| rawRequest | - | 生のリクエスト文字列 |
| requestedProduct | ○ | 対象商品タイプ |
| taskType | - | feature/bugfix/docs/refactor/test/config/release |
| taskGoal | - | タスクの目的 |
| expectedOutputs | - | 期待される成果物 |
| riskLevel | - | 上書き用 (low/medium/high) |
| dataLevel | - | 上書き用 (A/B/C) |

## 対応商品タイプ
- `sales_dx` → kosame-sales-dx
- `anesty_board` → kosame-anesty-board
- `backoffice_agent` → kosame-backoffice-agent
- `email_reply_bot` → kosame-email-reply-bot
- `cloud_run_pm_agent` → kosame-dev-orchestra

## 拒否トリガーワード
secret / .env / api key / customer data / personal info / health record / insurance / individual name / password / credential

## 安全ルール
- rejectedIfIncludesSecrets: true 固定
- 拒否トリガーワード含む要求は intakeValid: false
- noRealRepoAccess / noRealExecution: true 固定
