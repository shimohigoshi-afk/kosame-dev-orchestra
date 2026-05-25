# v87.0.9 KOSAME Dev Orchestra — Permission Strategy v0.1.0

## 作業名

Claude Code permission strategy / command batching

## 目的

KOSAME Dev Orchestra における Claude Code の権限方針と command batching 方針を文書化し、
smoke テストで検証可能にする。

**じゅんやさんをコピペ作業員にしない**ことを最重要目標とし、
危険な操作（`git push` / `deploy` / Secret Manager）だけ human approval に残し、
安全な確認・編集・検証はまとめて扱えるようにする。

## 背景

- v87.0.4〜v87.0.8 を通じて、Claude Code が逐次確認を出しすぎる問題が顕在化
- 確認のたびにじゅんやさんが対応しなければならず、コピペ作業員状態になっていた
- 安全な操作と危険な操作の境界を明確に定義し、Claude Code が自律的に進められる範囲を広げる
- command batching 方針を標準化することで、じゅんやさんの作業を「貼る・見る・判断する」の3点に集約する

## 今回作るファイル

| ファイル | 役割 |
|---|---|
| `docs/ai-dev-team/permission-policy-v0.1.0.md` | Claude Code 権限方針の定義（許可・human approval・禁止の3分類） |
| `docs/ai-dev-team/claude-code-command-batching-v0.1.0.md` | command batching 方針・悪い例/良い例・完了報告テンプレート |
| `tickets/common/kosame_dev_orchestra_permission_strategy_v0_1_0.md` | 本チケット |
| `smoke/dev-agent-permission-policy-smoke.js` | ドキュメント存在・必須キーワード検証 smoke |

## 触ってよいファイル

- `docs/ai-dev-team/` 配下（新規作成）
- `tickets/common/` 配下（新規作成）
- `smoke/` 配下（新規作成）
- `package.json`（smoke スクリプト追加のみ）
- `verify.sh`（v87.0.9 セクション追加のみ）

## 触ってはいけないファイル

- `.env` / `.env.*`
- `bot.js` / `BOARD_CANON.js`
- `Dockerfile` / `.dockerignore`
- `tools/` 配下の既存ファイル
- `docs/cloud-run/` 配下
- `docs/pm/` 配下の既存ファイル
- Railway / Cloud Run / gcloud 設定ファイル
- Secret Manager 関連ファイル

## 禁止事項

- `.env` / `.env.*` の読み取り
- `printenv` / `env` の実行
- `rm -rf`
- `git reset --hard` / `git clean`
- `git push` / `git tag`
- `gcloud` / `railway` コマンド
- Cloud Run deploy / Secret Manager の値閲覧・変更
- `curl | bash` / `wget | bash`
- 外部 API への実接続
- 本番データの削除

## 検証コマンド

```bash
node --check smoke/dev-agent-permission-policy-smoke.js
npm run smoke:dev-agent-permission-policy
npm run verify
git diff --stat
git diff --name-only
```

## 完了条件

- [ ] `docs/ai-dev-team/permission-policy-v0.1.0.md` が作成されている
- [ ] `docs/ai-dev-team/claude-code-command-batching-v0.1.0.md` が作成されている
- [ ] `tickets/common/kosame_dev_orchestra_permission_strategy_v0_1_0.md` が作成されている
- [ ] `smoke/dev-agent-permission-policy-smoke.js` が作成されている
- [ ] `npm run smoke:dev-agent-permission-policy` が成功する
- [ ] `npm run verify` が成功する
- [ ] `bot.js` に差分がない
- [ ] `.env` / `.env.*` にアクセスしていない
- [ ] 外部 API 接続をしていない

## human approval が必要な操作

| 操作 | 理由 |
|---|---|
| `git commit` | 変更内容の最終確認 |
| `git push` | リモートへの反映 |
| `deploy` | 本番影響あり |
| Secret Manager の変更 | 秘密情報の管理 |

## 次の作業 v87.0.10 への接続

本チケット完了後、以下を v87.0.10 として着手することを推奨する。

| 候補 | 内容 |
|---|---|
| v87.0.10 | GitHub Actions で `npm run verify` と `npm run smoke:*` を自動実行する CI ワークフロー追加 |
| v87.0.10-b | PR 作成時に smoke / verify を CI チェックとして必須化（branch protection rule との接続） |
| v87.0.11 | permission-policy を `tools/dev-agent-routing-policy.js` に接続し、ルーティング判断に反映 |

v87.0.10 では以下の GitHub Actions ワークフローを想定する：

```yaml
name: verify
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci --omit=dev
      - run: npm run verify
      - run: npm run smoke:dev-agent-permission-policy
      - run: npm run smoke:dev-agent-routing
      - run: npm run smoke:cloudrun
```

commit / push / deploy は引き続き human approval とする。
