# Actions Failure Triage (v0.6.2)

## 失敗時の仕分け（Triage）ルール

| 失敗箇所 | 推定原因 | 次アクション |
|---|---|---|
| `npm run verify` | コードの論理・文法エラー | Claude Repair Intake 作成 |
| `npm run smoke:*` | 統合・環境エラー | こさめ PM が環境変数等をチェック |
| `docker build` | Dockerfile・依存関係エラー | Claude Code で Dockerfile 修正 |
| `gcloud deploy` | 権限・クォータ・認証エラー | じゅんやさん（社長）へエスカレーション |

## トリアージ・レポート
失敗時には以下の項目を Decision Log に記録する。
- **Run ID**: 失敗した実行の ID
- **Root Cause**: トリアージ結果による推定原因
- **Repair Ticket**: 発行した補修チケット ID
