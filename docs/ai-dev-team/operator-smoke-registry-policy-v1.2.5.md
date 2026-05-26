# Operator Smoke Registry Policy v1.2.5

## ポリシー

### 登録ルール
1. 新しいパックを追加したら必ず smoke test を作成し、レジストリに登録する
2. smoke test のファイル名は `smoke/dev-agent-<pack-name>-smoke.js` に統一する
3. package.json の `verify` スクリプトに必ず追加する

### リリース判定ルール
- 全必須 smoke test が pass であること
- `npm run verify` が0 exit で完了すること
- `node --check` がすべてのファイルで通過すること

### 禁止事項
- smoke test をスキップしてリリースしない
- `status: "failed"` のままでリリースしない
- 新パック追加時にレジストリ更新を忘れない

### エラー対応
- smoke test が fail した場合：即座に修正してから verify を再実行
- レジストリと実際のファイルが乖離した場合：レジストリを更新する
