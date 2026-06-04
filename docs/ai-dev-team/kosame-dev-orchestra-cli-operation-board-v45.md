# KOSAME Dev Orchestra CLI Operation Board v45.0.0

## 概要

Shell上でOperation Boardを表示するpackです。
「今どのAIが何をしているか」「どのstageにいるか」「危険ゲートがどうなっているか」「次に何をすべきか」を視覚的に確認できます。

## 役割定義

| レイヤー | 説明 |
|---------|------|
| **ANESTY Board** | Discordで魅せる表側のプロダクト |
| **KOSAME Dev Orchestra** | Shellで動かす裏側の開発部門 |

ANESTY BoardはDiscordに表示する顧客向け画面。
KOSAME Dev OrchestraはShell上で動く開発・デプロイ管理の内部システム。
この v45 packはKOSAME Dev Orchestra側の視覚化ラインの一部です。

## 表示セクション

### TARGET
- Product / Task / Repo / Orchestra Version / Commit

### STAGE
| ステージ | 意味 |
|---------|------|
| Intake | タスク受け入れ |
| Work Order | 作業指示書作成 |
| Safety Gate | 安全ゲート確認 |
| Claude Prompt | Claudeへのプロンプト準備 |
| Claude Implementation | Claude Codeによる実装 |
| Verify | `npm run verify` による検証 |
| Acceptance Gate | こさめ/GPT による受入チェック |
| Human Approval | じゅんやさんの最終YES |

### AGENTS
| Agent | 役割 |
|-------|------|
| KOSAME / GPT | PM・安全ゲート・統合判断 |
| Claude / Kuro | 実装担当 |
| Gemini | Bulk work / draft expansion |
| Grok | Research / analysis |
| GitHub Actions | CI/CD |
| Cloud Shell | CLI inspection |
| Human / Junya | **最終YES担当** |

### DANGER GATES (常にBLOCKED)

- Secret read
- .env read
- deploy (any form)
- git push by AI
- customer data read
- destructive delete

### NEXT ACTION / ACCEPTANCE
- 次に人間またはAIがやること
- commit candidate / human approval required / blockers

## 安全設計

- `dryRun: true` — 常にdry-run
- `humanApprovalRequired: true` — じゅんやさんのYES必須
- git add/commit/push/tag は Claude Code が実行しない
- じゅんやさんを作業員に戻さない

## 使用方法

```bash
npm run pm-agent:cli-operation-board
# または
node tools/dev-agent-cli-operation-board-pack.js
```

smokeテスト:
```bash
npm run smoke:cli-operation-board
```

## ANSI表示について

カラー表示はANSIエスケープを使用しますが、色に依存しないテキストも必ず出力します。
CIやログ保存でANSIが除去されても読める形です。

## Discord連携

現時点ではDiscord連携しません。
将来の拡張先として v47 Visual Status JSON Exportが基盤を提供します。

## 関連Pack

- v46.0.0 Markdown Operation Report Export
- v47.0.0 Visual Status JSON Export
