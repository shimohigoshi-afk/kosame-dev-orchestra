# プロジェクト引き継ぎテンプレート v0.1.0

## このテンプレートの使い方

新しい開発チャットを始めるとき、または別プロジェクトに切り替えるときに、
以下のテンプレートをコピーして空欄を埋め、プロンプトの冒頭に貼ってください。

こさめ・Claude Code・Gemini が迷わず作業を再開できる状態を作ることが目的です。

---

## テンプレート本文（ここからコピーして使う）

---

あなたは KOSAME Dev Orchestra repo の実装担当です。

**プロジェクト名:**
[例: KOSAME Dev Orchestra / KOSAME 営業 DX / スマホ PWA / 議事録 DX]

**対象 repo:**
[例: ~/kosame-dev-orchestra]

**絶対に触らない repo:**
[例: ~/anesty-board（KOSAME Dev Orchestra 作業時）]

**現在の正本 commit:**
[git log --oneline -1 で確認してから記入]

**今回の作業対象:**
[例: docs/ai-dev-team/reuse-guide-v0.1.0.md の作成]

**使用する共通設計書（KOSAME Dev Orchestra）:**
- `~/kosame-dev-orchestra/docs/ai-dev-team/KOSAME_DEV_ORCHESTRA_SPEC_v0.1.0.md`
- `~/kosame-dev-orchestra/docs/ai-dev-team/permission-policy-v0.1.0.md`
- `~/kosame-dev-orchestra/docs/ai-dev-team/claude-code-command-batching-v0.1.0.md`
- `~/kosame-dev-orchestra/docs/ai-dev-team/role-map-v0.1.0.md`
- `~/kosame-dev-orchestra/docs/ai-dev-team/operating-flow-v0.1.0.md`

**個別プロジェクト設計書:**
[パスを記入、なければ「なし」]

**直近の完了事項:**
- [完了した作業を箇条書き]

**次にやること:**
- [今回の作業内容を箇条書き]

**触ってよいファイル:**
- [ファイルパスを列挙]

**触ってはいけないファイル:**
- `.env` / `.env.*`
- Secret Manager 関連
- Cloud Run / Railway 設定
- `~/anesty-board` 配下のすべて
- [プロジェクト固有の禁止ファイルを追記]

**禁止事項:**
- `.env` / `.env.*` の読み取り
- `printenv` / `env` の実行
- `rm -rf`
- `git reset --hard` / `git clean`
- `git push` / `git tag`（Human Approval が必要）
- `gcloud` / `railway` コマンド
- `curl | bash` / `wget | bash`
- 外部 API への実接続

**Human Approval が必要な操作:**
- `git commit`
- `git push`
- `deploy`（Cloud Run / Railway）
- Secret Manager の値閲覧・変更
- 課金・外部 API 実接続

**検証コマンド:**
```bash
npm run verify
git diff --stat
git diff --name-only
```

**完了報告フォーマット:**

1. 変更したファイル一覧
2. 各ファイルの役割
3. 実行した検証コマンドと結果
4. 実行していない検証コマンドがあれば理由
5. 未対応リスク
6. 次にやるべきこと

---

## テンプレートここまで

---

## 注意事項

### ANESTY Board との混線防止

- ANESTY Board の `v87.0.x` と KOSAME Dev Orchestra の `v0.1.x` を混在させない
- KOSAME Dev Orchestra の次作業番号は `v0.1.1`, `v0.1.2`, `v0.1.3`, `v0.2.0` ... を使う
- `v87.0.x` を KOSAME Dev Orchestra の次作業番号として使ってはならない

### Human Approval の範囲

commit / push / deploy は必ずじゅんやさんが最終承認する。
このテンプレートに記載されている操作も、じゅんやさんの承認なしに実行しない。

### こさめ PM の役割

このテンプレートを埋めるのはこさめ PM の役割。
Claude Code はテンプレートに従って作業するだけで、設計判断はしない。
