# Claude Code Fix Packet v0.4.4

Claude Code 専用の「バグ修正・実装」タスクパケット定義。

---

## 概要

失敗したテストの修正や、具体的な機能実装を Claude Code に依頼するためのパケット形式。
「何を」「どこに」「どのように」直すべきかのコンテキストを凝縮して伝える。

---

## パケット構造 (拡張部分)

```json
{
  "payload": {
    "failureContext": {
      "errorOutput": "...",
      "failingTests": ["smoke/test-a.js"],
      "reproSteps": "npm run smoke:test-a"
    },
    "fixInstructions": "...",
    "safetyBoundary": {
      "allowedCommands": ["npm run smoke:*"],
      "prohibitedFiles": [".env"]
    }
  }
}
```

---

## 運用フロー

1. **不具合検知**: `npm run verify` 等で失敗が発生。
2. **パケット生成**: PM Agent が失敗ログを解析し、`ClaudeFixPacket` を生成。
3. **修正依頼**: Claude Code にパケットを渡し、自律的な修正と再検証を指示。
4. **完了報告**: 修正が完了し、テストがパスしたことを確認して終了。

---

## 指示のポイント

- **具体性**: 「直して」ではなく「`error-a` を回避するために `src/lib.js` の 42 行目の条件式を修正せよ」のように具体的に書く。
- **検証の明示**: 修正後に実行すべき `smoke` スクリプトを必ず指定する。

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v0.4.4 | 初版作成。実装エージェントへの指示伝達を効率化。 |
