# Operator Unified CLI Command Map v1.2.1

| コマンド | 解決先ツール | 説明 |
|---|---|---|
| `status` | operator-cli-status | 現在のオペレーター状態表示 |
| `next` | operator-next-action-engine | 次推奨アクション提示 |
| `approval` | operator-approval-summary | 承認サマリー生成 |
| `handoff` | operator-handoff-cli | セッション引き継ぎ文書生成 |
| `verify-record` | verify-result-recorder-cli | npm run verify 結果手動記録 |
| `actions-record` | github-actions-recorder-cli | GitHub Actions 結果手動記録 |
| `dashboard` | operator-dashboard-snapshot | ダッシュボードスナップショット |
| `release` | operator-release-record-pack | リリース完了記録 |
| `escalate-claude` | operator-claude-escalation-pack | Claude 技術顧問エスカレーション |
| `next-gemini` | operator-gemini-next-work-pack | Gemini 次期作業インテーク |
| `help` | (built-in) | コマンド一覧表示 |

## 禁止事項
- このCLIは git push / deploy / Secret閲覧 を一切行わない
- Human Approval Gate が必要な操作は必ずじゅんやさんに提示する
