# Operator Console Endpoints (v0.9.0)

## エンドポイント一覧
| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/operator/status` | 現在のサマリー状態を取得。 |
| GET | `/operator/dashboard` | ダッシュボード用ウィジェットデータを取得。 |
| GET | `/operator/next-action` | 推奨される次のアクションを取得。 |
| GET | `/operator/handoff` | 引継ぎ Markdown を取得。 |
| GET | `/operator/approvals` | 承認待ちリストを取得。 |
| POST | `/operator/decision` | 承認・却下等の判断を送信。 |

## レスポンス例 (`GET /operator/status`)
```json
{
  "workflowStatus": "Idle",
  "currentVersion": "0.9.0",
  "riskLevel": "Low"
}
```
