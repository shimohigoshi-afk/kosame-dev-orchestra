# GitHub Actions Status Policy (v0.8.2)

## 更新タイミング
- ローカルから `gh run list` を定期実行し、結果を `fixtures/github-actions.json` に反映する。

## アクション判定
- `success`: 正本化（Production Deploy または Release Tag）を許可。
- `running`: 待機（Operator は他の作業を進めて良いが、Deploy は禁止）。
- `failed`: 補修モードへ移行。`verify-result.json` と合わせて Claude に解析を依頼。
- `cancelled`: 再実行または手動確認。

## 禁止事項
- `success` が確認されるまで、`operator-state.json` の `currentPhase` を `Production` に移行しない。
