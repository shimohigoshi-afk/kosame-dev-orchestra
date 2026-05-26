# Operator Safety Contract v1.2.4

## 安全契約

Local Operator Console を使用するすべてのエージェント・オペレーターは本契約を遵守する。

## 禁止アクション（実行禁止）

| アクション | 理由 |
|---|---|
| `git push` | 外部リポジトリへの影響 |
| `git commit` | ローカル履歴の変更 |
| `git tag` | リリースタグの誤作成防止 |
| `gcloud run deploy` | 本番環境への影響 |
| `docker build / push` | イメージビルド・配布 |
| `rm -rf` | データ削除リスク |
| `git reset --hard / git clean` | 作業内容の破壊 |
| `.env / Secret 閲覧` | 機密情報漏洩リスク |
| 課金API実行 | コスト発生リスク |

## 許可アクション

| アクション | 条件 |
|---|---|
| ファイル作成・編集 | リポジトリ内のみ |
| `node --check` | 構文検証のみ |
| `npm run verify` | smoke test 実行 |
| `git status / diff` | 読み取りのみ |

## Human Approval Gate

以下は必ずじゅんやさんの承認を得てから実行：
- git commit / push / tag
- deploy / gcloud
- Secret Manager
- 課金・外部API本接続
