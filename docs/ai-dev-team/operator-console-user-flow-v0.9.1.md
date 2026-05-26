# Operator Console User Flow (v0.9.1)

## 標準フロー
1. **Login/Access**: コンソールを開き、最新の状態を確認。
2. **Review Status**: リスクが高い場合や、検証が失敗している場合に警告を確認。
3. **Decide Approvals**: 承認が必要な項目を一つずつ確認し、`Approve` または `Send to Claude` 等を選択。
4. **Take Next Action**: 提示されたコマンドをコピーし、Cloud Shell 等で実行。
5. **Session End**: 作業完了後、`Generate Handoff` を実行して終了。

## 例外フロー
- **Verify Failure**: 検証失敗カードをクリックし、詳細なエラーログを確認。
- **High Risk Action**: 実行前に「本当に実行しますか？」の警告を表示。
