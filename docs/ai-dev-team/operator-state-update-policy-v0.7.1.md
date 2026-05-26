# Operator State Update Policy (v0.7.1)

## 更新タイミング
- エージェントがタスクを完了した時。
- 検証（verify）が完了し、成功または失敗が確定した時。
- 承認ゲートに到達した時。
- 手動でフェーズを切り替えた時。

## 更新者
- **Gemini Agent**: 大量生成後の状態更新。
- **Claude Code**: 補修完了後の状態更新。
- **こさめPM**: 承認後の状態更新。
- **Operator (Junya)**: コマンド実行による状態更新。

## 禁止事項
- `fixtures/operator-state.json` 以外に状態を分散させない（真実の単一ソース）。
- 未検証の状態で `workflowStatus` を `Success` にしない。
