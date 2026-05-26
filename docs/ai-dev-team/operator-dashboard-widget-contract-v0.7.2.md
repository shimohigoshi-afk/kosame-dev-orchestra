# Operator Dashboard Widget Contract (v0.7.2)

## ウィジェットの種類
- `StatusCard`: 状態表示用
- `ActionButton`: 操作実行用
- `ApprovalList`: 承認待ち表示用
- `LogViewer`: ログ・履歴表示用

## データ形式
```json
{
  "type": "StatusCard",
  "id": "workflow-status",
  "title": "Workflow Status",
  "value": "Idle",
  "status": "info",
  "icon": "pause-circle"
}
```

## ステータス定義
- `success`: 緑（正常）
- `warning`: 黄（注意・承認待ち）
- `error`: 赤（異常・停止）
- `info`: 青（情報）
