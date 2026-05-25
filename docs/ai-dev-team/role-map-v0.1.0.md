# KOSAME Dev Orchestra 役割分担マップ v0.1.0

## 全体像

```
じゅんやさん（最終判断・Human Approval）
    |
    ├── こさめ PM（設計・切り分け・安全ゲート）
    |       ├── Gemini Agents（下読み・要約・GCP 観点レビュー）
    |       └── Claude Code（実装・差分作成）
    |
    ├── GitHub Actions（自動検証）
    |
    └── [承認後の実行基盤]
            ├── Cloud Run（実行基盤）
            ├── Secret Manager（秘密情報管理）
            ├── GCS / Firestore（成果物保存・状態管理）
            └── n8n（配線盤）
```

---

## じゅんやさん（事業責任者 / 最終判断者）

**担当すること:**
- 事業要件・優先度の決定
- commit / push / deploy の最終承認（Human Approval）
- Secret Manager の変更承認
- 課金・外部 API 実接続の承認
- 完了報告の確認

**担当しないこと（AI チームに任せる）:**
- ファイルの編集・作成
- smoke / verify の実行
- ドキュメントの作成
- diff の詳細確認

---

## こさめ PM（設計責任者 / 切り分け / 安全ゲート）

**担当すること:**
- 作業範囲の設計・切り分け
- ANESTY Board と KOSAME Dev Orchestra の混線防止チェック
- 安全ゲート判断（何を Human Approval にするか）
- Claude Code へのチケット設計
- Gemini へのタスクパケット設計
- 完了報告の内容確認

**担当しないこと:**
- 最終的な commit / push / deploy 承認（じゅんやさんに任せる）
- 実装（Claude Code に任せる）

---

## Gemini Agents（下読み / 要約 / GCP 観点レビュー）

**担当すること:**
- 長文ドキュメントの読み取り・要約
- ログの整理・要約
- GCP / Cloud Run / Secret Manager / GCS / Firestore の設定レビュー
- diff の一次レビュー
- コスト見積もり

**担当しないこと:**
- 最終的なアーキテクチャ判断（こさめ PM / じゅんやさんに任せる）
- `.env` / Secret Manager の実際の値の読み取り
- commit / push / deploy の決定

---

## Claude Code（実装担当）

**担当すること:**
- チケットに従ったファイルの作成・編集
- smoke / verify スクリプトの実装・実行
- `node --check` による構文確認
- `git status` / `git diff` / `git log` の参照
- 完了報告の作成

**担当しないこと:**
- プロジェクトの設計判断（こさめ PM に任せる）
- commit / push / deploy の実行（Human Approval が必要）
- `.env` / Secret Manager の値の読み取り

---

## GitHub Actions（自動検証）

**担当すること:**
- push / PR 時の `npm run verify` 自動実行
- smoke スクリプトの自動実行
- `node --check` による構文チェック
- テスト結果のレポート

**担当しないこと:**
- commit の作成（Claude Code + Human Approval）
- deploy の実行（Human Approval が必要）
- secrets の変更

---

## Cloud Run（実行基盤）

**担当すること:**
- アプリケーションの実行
- スケーリング
- ヘルスチェック

**担当しないこと:**
- ビジネスロジックの決定
- secrets の管理（Secret Manager に任せる）

---

## GitHub（正本管理）

**担当すること:**
- ソースコードの正本管理
- Pull Request / コードレビュー
- Branch 管理

---

## Secret Manager（秘密情報管理）

**担当すること:**
- API キー・トークン・パスワードの保管
- アクセス制御（IAM）

**ルール:**
- Claude Code に Secret Manager の値を直接渡してはならない
- Gemini に Secret Manager の値を読ませてはならない
- secrets は必ず Secret Manager 経由で管理する

---

## GCS / Firestore（成果物保存・状態管理）

**担当すること:**
- 生成物・ドキュメント・ログの保存（GCS）
- 実行状態・設定の管理（Firestore）

---

## n8n（配線盤）

**担当すること:**
- ジョブの配布・ルーティング
- Webhook 受信・転送

**担当しないこと:**
- 司令塔（意思決定はこさめ PM / じゅんやさんが行う）
- secrets の管理（Secret Manager に任せる）

---

## Human Approval ゲート一覧

| 操作 | 承認者 |
|---|---|
| git commit | じゅんやさん |
| git push | じゅんやさん |
| deploy（Cloud Run / Railway） | じゅんやさん |
| Secret Manager 変更 | じゅんやさん |
| 課金・外部 API 実接続 | じゅんやさん |
| PR / issue 作成 | じゅんやさん |
