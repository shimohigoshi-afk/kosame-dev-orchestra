# Verify Result History Policy (v0.8.1)

## 保存先
`fixtures/verify-result.json` に最新の実行結果を保存する。過去の履歴は `fixtures/history/verify-result-[TIMESTAMP].json` に保存することを推奨する（任意）。

## 更新ルール
- `npm run verify` 実行のたびに上書き更新する。
- 失敗した場合は `commitAllowed` を必ず `false` に設定する。
- 成功した場合は `commitAllowed` を `true` にし、こさめPMの最終確認へ回す。

## 連携
- `operator-state.json` の `workflowStatus` を、検証結果に基づいて `Success` または `Failure` に更新する。
