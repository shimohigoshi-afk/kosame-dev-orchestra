# Agent Dispatch State Machine (v0.5.2)

## 状態定義
| 状態 | 説明 |
|---|---|
| `queued` | キューに投入された初期状態 |
| `assigned` | 実行エージェントが割り当てられた状態 |
| `running` | エージェントが作業を実行中 |
| `needs_review` | 作業完了。PM または人間によるレビューが必要 |
| `blocked` | 外部要因（依存関係・承認待ち）で停止中 |
| `completed` | レビューを通過し、完了 |
| `failed` | エラーまたは否認により失敗 |

## 遷移ルール
- `running` -> `failed` の場合、自動的に `claude-repair` へ再割り当てされる場合がある（v0.5.4 参照）。
- `needs_review` で否認された場合、`queued` に戻るか `failed` となる。
