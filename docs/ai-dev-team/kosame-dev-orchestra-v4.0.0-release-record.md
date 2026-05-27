# KOSAME Dev Orchestra v4.0.0 Release Record

## バージョン
v4.0.0 — Kosame VP Practical Operating Console Pack

## リリース日
2026-05-27

## 目的
v3.6.0〜v3.9.0を統合し、こさめ副社長がCloud Shellで1コマンド実行するだけで、状態読取・判断・安全コマンド提案・承認ゲート・引継ぎを実用的に回せる状態を実現する。

---

## 実装ファイル

### ツール (tools/)
| ファイル | バージョン | 説明 |
|---|---|---|
| `tools/kosame-vp-practical-console.js` | v4.0.0 | v3.6〜v3.9統合実用コンソール |
| `tools/kosame-cli-runner.js` | v3.6.0 | Cloud Shell CLIランナー |
| `tools/kosame-real-repo-snapshot.js` | v3.7.0 | テキスト入力スナップショットリーダー |
| `tools/kosame-approval-board.js` | v3.8.0 | 承認Board + Human YES Compression |
| `tools/kosame-handoff-auto-generator.js` | v3.9.0 | 引継ぎメモ自動生成 |

### スモーク (smoke/)
| ファイル | アサーション数 |
|---|---|
| `smoke/dev-agent-kosame-vp-practical-console-smoke.js` | 52 |
| `smoke/dev-agent-v4.0.0-release-record-smoke.js` | リリース確認 |

---

## VP Practical Console コマンド一覧

| コマンド | 内容 |
|---|---|
| `npm run kosame:status` | 全体健全性 + overallHealth確認 |
| `npm run kosame:commit-check` | commit YES/NO/HOLD判断 |
| `npm run kosame:push-check` | push判断 (じゅんやさんYES必要) |
| `npm run kosame:release-check` | release判断 (じゅんやさんYES必要) |
| `npm run kosame:dispatch` | 次エージェントdispatch判断 |
| `npm run kosame:approval` | 承認ゲート確認 |
| `npm run kosame:handoff` | 引継ぎ準備確認 |
| `npm run kosame:next` | 次の最優先アクション |

`approval-board` と `handoff` (detailed) は `kosame-vp-practical-console.js` から直接呼び出せる。

---

## Safe Command Boundary (明文化)

### 提案してよいコマンド
- git status
- git log --oneline -N
- git diff --name-only
- node --check
- npm run verify
- gh run list --limit N
- git add (個別ファイル指定)
- git commit (humanApprovalRequired: false)
- git push origin main (humanApprovalRequired: **true**)
- git tag -a vX.Y.Z (humanApprovalRequired: **true**)
- git push origin vX.Y.Z (humanApprovalRequired: **true**)

### 絶対に生成しないコマンド
- rm -rf
- git reset --hard
- git clean -f
- cat .env / Secret / APIキーアクセス
- gcloud run deploy
- docker build
- 外部APIコール (fetch/curl)
- 課金API実行
- 無承認 git push
- 無承認 git tag

---

## VP Practical Decision Packet

現在状態から最重要の次アクション1つを出力する：
- `topPriority.action`: 次アクション名
- `topPriority.priority`: high / normal / low
- `topPriority.requiresHumanApproval`: じゅんやさんYES要否
- `topPriority.suggestedCommand`: 提案コマンド

---

## snapshotSource

| 値 | 意味 |
|---|---|
| `text` | textInputs (git status等テキスト) からスナップショット構築 |
| `raw` | rawData (構造化データ) からスナップショット構築 |
| `combined` | combined-state-snapshot経由 |
