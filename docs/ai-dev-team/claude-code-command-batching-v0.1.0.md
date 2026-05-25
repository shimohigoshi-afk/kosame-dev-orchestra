# KOSAME Dev Orchestra — Claude Code command batching 方針 v0.1.0

## 概要

Claude Code の確認地獄を防ぐための command batching 方針を定義する。
**じゅんやさんをコピペ作業員にしない**ことを最優先とし、
逐次確認ではなくまとめて実施・最後に一括報告する形式を標準とする。

---

## 方針

### 1. 作業開始前に許可範囲・禁止範囲・検証範囲を宣言する

Claude Code が作業を始める前に、以下を一度だけ宣言する：

```
許可範囲: [今回触ってよいファイル・操作の一覧]
禁止範囲: [今回触らないファイル・実行しないコマンドの一覧]
検証範囲: [完了後に実行する検証コマンドの一覧]
```

### 2. 細かい確認を逐次出さない

- ファイルを1つ編集するたびに確認を求めない
- 安全な操作（読み取り・文書作成・smoke 追加）はまとめて実施する
- 不確実性が高い操作だけ事前に確認する

### 3. 完了後にまとめて一括報告する

作業完了後は「完了報告テンプレート」の形式で一括報告する。

---

## 悪い例 / 良い例

### 悪い例：逐次確認（コピペ作業員製造パターン）

```
Claude: docs/ai-dev-team/ ディレクトリを作成しますか？
→ じゅんや: はい
Claude: permission-policy-v0.1.0.md を作成しますか？
→ じゅんや: はい
Claude: command-batching-v0.1.0.md を作成しますか？
→ じゅんや: はい
Claude: smoke ファイルを作成しますか？
→ じゅんや: はい
Claude: package.json を更新しますか？
→ じゅんや: はい
```

**→ じゅんやさんをコピペ作業員にしている。このパターンを禁止する。**

### 良い例：宣言 → まとめ実施 → 一括報告（command batching）

```
Claude: [作業開始宣言]
- 許可範囲: docs/ai-dev-team/, tickets/common/, smoke/, package.json, verify.sh
- 禁止範囲: .env, bot.js, BOARD_CANON.js, gcloud, deploy, Secret Manager
- 検証範囲: node --check, npm run smoke:*, npm run verify, git diff --stat
→ [許可範囲内を一括実施]
→ [検証コマンドを一括実行]
→ [完了報告テンプレートで一括報告]
```

**→ じゅんやさんがすることは「commit / push / deploy を判断する」だけ。**

---

## 許可範囲の例示

| カテゴリ | 許可操作 |
|---|---|
| 読み取り | コード・ドキュメント・ログ（`.env`・秘密情報を除く） |
| 作成・編集 | `docs/`・`tickets/`・`smoke/`・`tools/` 配下のファイル |
| 検証実行 | `node --check`・`npm run smoke:*`・`npm run verify` |
| git 参照 | `git status`・`git diff`・`git log` |

## 禁止範囲の例示

| カテゴリ | 禁止操作 |
|---|---|
| 秘密情報 | `.env`・Secret Manager・API キーの読み取り |
| 本番操作 | `deploy`・`gcloud`・`railway`・Cloud Run |
| 破壊操作 | `rm -rf`・`git reset --hard`・`git clean` |
| 外部接続 | 外部 API への実接続・`curl \| bash` |
| 確定操作 | `git push`・`git tag`（human approval 必要） |

## 検証範囲の例示

| コマンド | 目的 |
|---|---|
| `node --check <file>` | JS 構文チェック |
| `npm run smoke:*` | smoke テスト実行 |
| `npm run verify` | 全体 verify |
| `git diff --stat` | 変更ファイル一覧確認 |
| `git diff --name-only` | 変更ファイル名確認 |

---

## Claude Code 完了報告テンプレート

---

### 完了報告

**1. 作成・変更したファイル一覧**

| ファイル | 操作 | 役割 |
|---|---|---|
| `path/to/file` | 新規作成 | 役割の説明 |

**2. 各ファイルの役割**

[簡潔な説明]

**3. 実行した検証コマンドと結果**

```
$ node --check smoke/xxx.js → OK
$ npm run smoke:xxx         → PASS
$ npm run verify            → VERIFY PASSED
$ git diff --stat           → [変更一覧]
$ git diff --name-only      → [変更ファイル名]
```

**4. 実行していない検証コマンドがあれば理由**

[理由を明記]

**5. 未対応リスク**

[あれば明記]

**6. 次にやるべきこと**

[次の作業候補]

---

## human approval が必要な操作（毎回確認）

以下は必ず human approval（じゅんやさんの判断）を仰ぐ：

| 操作 | 理由 |
|---|---|
| `git commit` | 変更内容の最終確認 |
| `git push` | リモートへの反映 |
| `deploy`（Cloud Run / Railway） | 本番反映 |
| Secret Manager の変更 | 秘密情報の管理 |
| 課金・外部 API の実接続 | コスト発生 |

---

## 関連ドキュメント

- `docs/ai-dev-team/permission-policy-v0.1.0.md` — 権限方針の全体定義
- `docs/pm/system-dev-agent-team-spec.md` — KOSAME Dev Orchestra チーム構成
