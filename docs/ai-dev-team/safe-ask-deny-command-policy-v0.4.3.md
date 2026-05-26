# 安全・確認・禁止コマンドポリシー v0.4.3

Claude Code における具体的なコマンド実行可否リスト。

---

## 1. Safe Commands (Allowed) — 自律実行可能

以下のコマンドは、確認なしで実行してよい。

- **調査・探索**: `ls`, `pwd`, `find`, `grep`, `cat`, `head`, `tail`, `wc`
- **Git 読み取り**: `git status`, `git diff`, `git log`, `git branch`, `git show`
- **検証実行**: `npm run smoke:*`, `npm run verify`, `node -c` (構文チェック)
- **Git ステージング**: `git add <file>`, `git rm --cached <file>`
- **ディレクトリ操作**: `mkdir -p`

---

## 2. Ask Commands — 承認が必要

以下のコマンドは、実行前に必ずユーザーに確認する。

- **変更の確定**: `git commit`, `git mv`, `git checkout -b`
- **依存関係**: `npm install`, `npm update`, `npm uninstall`
- **インフラ/外部接続**: `gcloud`, `gsutil`, `bq`, `railway`
- **スクリプト実行**: `node <script>` (smoke 以外の汎用ツール)
- **ビルド**: `npm run build`
- **ファイル削除**: `rm <file>` (単一ファイルの削除)

---

## 3. Deny Commands — 原則禁止

以下のコマンドは実行しない。必要な場合は人間に依頼する。

- **秘密情報アクセス**: `env`, `printenv`, `cat .env`
- **破壊的 Git 操作**: `git reset --hard`, `git clean -fd`, `git push --force`
- **大規模削除**: `rm -rf /`, `rm -rf .git`
- **システム設定変更**: `chown`, `chmod` (特に 777 等), `sudo`
- **未確認バイナリ実行**: 外部からダウンロードしたスクリプトのパイプ実行

---

## ポリシーの適用例外

緊急時や、特定のタスクで事前に「この範囲の Ask コマンドを一時的に Allowed にする」という合意が人間との間でなされた場合は、その指示に従う。
ただし、その場合も記録（ログ）を残すこと。
