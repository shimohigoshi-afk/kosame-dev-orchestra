# KOSAME Dev Orchestra Practical Operation Board Display v48.0.0

## 概要

Operation Boardを日常運用で即表示できるpackです。
v47でOperation Boardの表示自体は実現しましたが、引数なしで落ちること・Product/Task等が「-」になることが課題でした。
v48では「引数なしでもデフォルト実用サンプルで即表示できる」を実現します。

## v47からの改善点

| 課題 | v47の状態 | v48の改善 |
|------|----------|----------|
| renderBoard()引数なし | エラー発生 | buildDefaultPacket()が引数なしで動作 |
| Product/Task/Repoが"-" | "-"表示 | KOSAME Dev Orchestra の実用サンプルで補完 |
| npm run だけで表示できない | 手動でpacket構築が必要 | pm-agent:show-operation-board で即表示 |
| version表示 | "-" | 48.0.0 として正しく表示 |

## 表示例

```
========================================================
 KOSAME Dev Orchestra Operation Board
========================================================

TARGET
  Product          : KOSAME Dev Orchestra
  Task             : Practical visual operation line
  Repo             : /home/shimohigoshi/kosame-dev-orchestra
  Orchestra Version: 48.0.0
  Commit           : HEAD

STAGE
  Intake                    DONE
  Work Order                DONE
  Safety Gate               DONE
  Claude Prompt             READY
  Claude Implementation     WAITING
  ...
```

## 使用方法

```bash
# 即表示
npm run pm-agent:show-operation-board

# カスタムpacketで表示
node -e "require('./tools/dev-agent-practical-operation-board-display-pack').displayBoard({ product: 'MyProduct', task: 'my task' })"
```

smokeテスト:
```bash
npm run smoke:practical-operation-board-display
```

## 安全設計

- `dryRun: true` — 常にdry-run
- `humanApprovalRequired: true` — じゅんやさんのYES必須
- 全DANGER GATES が `BLOCKED`
- git add/commit/push/tag は Claude Code が実行しない

## 関連Pack

- v45.0.0 CLI Operation Board (基底renderBoard)
- v49.0.0 Task Template Bank
- v50.0.0 Practical Build Line
