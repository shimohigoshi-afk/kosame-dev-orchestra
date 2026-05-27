# KOSAME Dev Orchestra v3.6.0 Release Record

## バージョン
v3.6.0 — Kosame CLI Actual Command Runner Pack

## リリース日
2026-05-27

## 目的
こさめ副社長がCloud Shell上で `npm run kosame:<command>` を実行し、人間が読みやすいフォーマットで状態・判断・安全コマンド案・禁止アクションを確認できる実用CLIランナーを追加する。

---

## 実装ファイル

### ツール (tools/)
| ファイル | 説明 |
|---|---|
| `tools/kosame-cli-runner.js` | Cloud Shell人間読み取り用CLIランナー。8コマンド対応。formatCliOutput()でテキスト出力 |

### スモーク (smoke/)
| ファイル | アサーション数 |
|---|---|
| `smoke/dev-agent-kosame-cli-runner-smoke.js` | 47 |
| `smoke/dev-agent-v3.6.0-release-record-smoke.js` | リリース確認 |

---

## CLI コマンド一覧

| コマンド | 説明 | humanApproval |
|---|---|---|
| `kosame:status` | 全体健全性確認 | false |
| `kosame:commit-check` | commit YES/NO/HOLD判断 | false |
| `kosame:push-check` | push判断（必ず承認が必要） | **true** |
| `kosame:release-check` | release判断（必ず承認が必要） | **true** |
| `kosame:dispatch` | 次エージェントのdispatch判断 | false |
| `kosame:approval` | 承認ゲート確認 | 状況による |
| `kosame:handoff` | 引継ぎ準備確認 | false |
| `kosame:next` | 次の最優先アクション判断 | 状況による |

---

## CLI Output フォーマット (Cloud Shell)

```
────────────────────────────────────────────────────
KOSAME STATUS  [v3.6.0]
────────────────────────────────────────────────────
  recommendation  : YES
  reason          : overallHealth: healthy | ...
  risk            : low
  humanApproval   : false
  nextAction      : request_release_approval
  overallHealth   : healthy

  Safe Commands:
    $ git status -sb
    $ git log --oneline -5
    $ npm run verify
    $ gh run list --limit 3

  FORBIDDEN (絶対実行禁止):
    ✗ rm -rf
    ✗ git reset --hard
    ✗ git clean -f
    ✗ cat .env / Secret閲覧 / APIキー直接アクセス
    ... (+6 more)
────────────────────────────────────────────────────
```

---

## 禁止アクション (FORBIDDEN_ACTIONS)
- rm -rf
- git reset --hard
- git clean -f
- cat .env / Secret閲覧 / APIキー直接アクセス
- gcloud run deploy
- docker build
- fetch() / curl 外部APIコール
- 課金API実行
- 無承認 git push origin main
- 無承認 git tag vX.Y.Z

---

## 安全設計
- すべての出力に `dryRun: true`
- push-check / release-check は常に `humanApprovalRequired: true`
- commit-check は `humanApprovalRequired: false`（commitはじゅんやさん不要）
- 実際のgit操作は一切実行しない


## CLI Runner

v3.6.0 introduces the Kosame CLI Runner entry point for practical Cloud Shell command routing in dry-run mode.
