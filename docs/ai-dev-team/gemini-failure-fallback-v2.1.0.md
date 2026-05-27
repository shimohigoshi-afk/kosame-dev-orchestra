# Gemini Failure Fallback Policy v2.1.0

## 概要

Gemini課長が以下の状態で停止した場合、Claude係長へのfallbackルールを定める。

---

## Gemini 停止パターンと対応

| 停止パターン | provider health 状態 | Claude fallback |
|---|---|---|
| QUOTA_EXHAUSTED | `gemini_quota_exhausted` | 即時fallback |
| timeout (応答なし) | `gemini_needs_fallback` | 10分タイマー後fallback |
| 確認質問で停止 | `gemini_needs_fallback` | こさめが代行判断→Claude指示 |
| shell tool 不足 | `gemini_needs_fallback` | Claudeへ切替 |
| 認証エラー | `gemini_auth_error` | 即時fallback |
| metadata server application default credentials error | `gemini_auth_error` | 即時fallback |
| refresh_token error | `gemini_auth_error` | 即時fallback |
| 完走報告なし | `gemini_needs_fallback` | 10分後fallback |
| package version未更新 | `gemini_needs_fallback` | Claude補修 |
| 10分以上無反応 | `gemini_needs_fallback` | 即時fallback |

---

## Fallback 実行手順

1. **こさめが停止を検知** → provider health を `gemini_needs_fallback` or `gemini_auth_error` に更新
2. **Fallback Routing Packet を生成** → Claude係長へ引き継ぎ情報を渡す
3. **Claude係長が引き継ぎ** → 元のタスク要件に従い実装継続
4. **verify実施** → npm run verify でsmokeをall pass確認
5. **完了報告** → こさめへ報告 → じゅんやさんへ承認パケット提出

---

## 注意事項

- GeminiのGCP認証エラーは環境問題であり実装失敗ではない
- fallback後もGeminiへの再依頼可能性を保持する（quota回復・再認証後）
- Claudeへfallback中はGeminiへの追加依頼を停止する

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v2.1.0 | 初版。Gemini停止パターン全件定義 |
