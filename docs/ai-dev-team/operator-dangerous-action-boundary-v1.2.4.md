# Operator Dangerous Action Boundary v1.2.4

## 危険アクション境界線

### Tier 1: 絶対禁止（エージェントが単独で実行不可）
- 本番環境へのデプロイ
- Secret / 認証情報の閲覧・変更
- 課金APIの実行
- データベースの変更・削除
- 外部へのプッシュ（git push, docker push）

### Tier 2: Human Approval 必須（じゅんやさんのYES後のみ実行可）
- git commit
- git tag
- gcloud コマンド
- PR / issue 作成
- .env の変更

### Tier 3: こさめPM承認推奨（エージェント単独可だが報告必要）
- 新規ファイル作成
- 既存ファイルの大幅変更
- package.json の変更
- README の更新

### Tier 4: 自由に実行可
- 読み取り専用操作
- node --check
- npm run verify
- git status / diff

## 境界線違反時の対応
1. 作業を即停止
2. こさめPMに状況報告
3. じゅんやさんに承認依頼
4. 承認後のみ再開
