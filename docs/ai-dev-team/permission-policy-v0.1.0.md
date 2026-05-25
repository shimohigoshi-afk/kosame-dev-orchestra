# KOSAME Dev Orchestra — Claude Code 権限方針 v0.1.0

## 概要

KOSAME Dev Orchestra における Claude Code の操作権限を定義する。
**じゅんやさんをコピペ作業員にしない**ことを最重要方針とし、
危険な操作だけを human approval（人間承認）に残す。

---

## 安全に許可しやすい操作（Claude Code が自律実行してよい）

| 操作 | 備考 |
|---|---|
| ファイルの読み取り（コード・ドキュメント・ログ） | `.env`・秘密情報含有ファイルを除く |
| ファイルの作成・編集（`docs/`・`tickets/`・`smoke/`・`tools/`） | 本番設定ファイルを除く |
| `node --check <file>` | 構文チェックのみ |
| `npm run smoke:*` | smoke スクリプトの実行 |
| `npm run verify` | verify.sh の実行 |
| `grep` / `find` / `ls` | ファイル探索 |
| `git status` / `git diff` / `git log` | 読み取り系 git コマンド |

---

## human approval（人間確認）が必要な操作

以下は必ずじゅんやさんの判断・承認を得てから実行する。

| 操作 | 理由 |
|---|---|
| `git commit` | 変更の確定。内容確認が必要 |
| `git push` | リモートへの反映。取り消しコストが高い |
| `git tag` | バージョン管理への影響 |
| `deploy`（Cloud Run / Railway） | 本番影響あり |
| `gcloud` コマンド | GCP リソースの変更 |
| `railway` コマンド | Railway リソースの変更 |
| Secret Manager の値閲覧・変更 | 秘密情報の漏洩リスク |
| `npm publish` | 外部公開 |
| 課金・外部 API キーを使う操作 | コスト発生 |
| PR / issue の作成・コメント | 外部への影響 |

---

## 原則禁止操作

| 操作 | 禁止理由 |
|---|---|
| `.env` / `.env.*` の読み取り | 秘密情報の漏洩リスク |
| `printenv` / `env` の実行 | 環境変数の一括漏洩リスク |
| `rm -rf` | 不可逆なファイル削除 |
| `git reset --hard` | 作業履歴の消去 |
| `git clean` | 未追跡ファイルの削除 |
| `curl \| bash` / `wget \| bash` | 未確認スクリプトの実行 |
| 外部 API への実接続 | 課金・情報漏洩リスク |
| 本番データの削除 | 不可逆な破壊 |

---

## 秘密情報を読ませないルール

- `.env` / `.env.*` を Claude Code に渡してはならない
- Secret Manager の値を Claude Code の文脈に含めてはならない
- API キー・トークン・パスワードをプロンプトに直接貼ってはならない
- 秘密情報が必要な場合は、Claude Code に「キーは存在するか？」の yes/no だけを確認させる

---

## じゅんやさんをコピペ作業員にしないための判断基準

Claude Code は以下を目標とする：

1. **許可範囲・禁止範囲・検証範囲を最初に宣言する**
   - 作業開始時に「今回やること・やらないこと・確認が必要な操作」を列挙する

2. **逐次確認ではなく command batching**
   - 細かいファイル編集ごとに確認を求めず、まとめて実施して最後に一覧報告する
   - command batching 方針（`claude-code-command-batching-v0.1.0.md` 参照）を適用する

3. **じゅんやさんの操作を最小化する**
   - じゅんやさんがすることは「Claude の出力を貼る」「結果を見る」「commit / push / deploy を判断する」の3点のみ
   - それ以外は Claude Code が完結させる

4. **危険な操作は human approval に戻す**
   - `git push` / `deploy` / Secret Manager の変更は必ず確認を求める
   - 不可逆操作は事前に明示する

---

## 関連ドキュメント

- `docs/ai-dev-team/claude-code-command-batching-v0.1.0.md` — command batching の具体的方針
- `docs/pm/system-dev-agent-team-spec.md` — KOSAME Dev Orchestra チーム構成
- `docs/pm/gemini-first-routing-policy.md` — Gemini first ルーティング方針
