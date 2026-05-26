# Operator Approval Decision Types (v0.7.5)

## アクション一覧
- `approve`: 承認し、次のステップへ進む。
- `hold`: 保留し、追加調査を命じる。
- `send_to_claude`: Claude に補修または詳細調査を依頼する。
- `send_to_gemini`: Gemini に別の案を作成させる。
- `reject`: 却下し、前の状態に戻す。

## 判断基準
| 項目リスク | 推奨アクション | 担当 |
| :--- | :--- | :--- |
| Low | `approve` | こさめPM (Auto) |
| Medium | `approve` / `hold` | こさめPM / Junya |
| High | `hold` / `send_to_claude` | Junya |
| Critical | `reject` / `manual_fix` | Junya |
