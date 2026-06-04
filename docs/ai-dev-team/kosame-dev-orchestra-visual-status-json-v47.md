# KOSAME Dev Orchestra Visual Status JSON Export v47.0.0

## 概要

CLI Operation Board (v45) / Markdown Report (v46) / 将来のDiscord通知 / Web dashboardに流用できる「状態JSON」を生成するpackです。

## 役割定義

| レイヤー | 説明 |
|---------|------|
| **ANESTY Board** | Discordで魅せる表側のプロダクト |
| **KOSAME Dev Orchestra** | Shellで動かす裏側の開発部門 |

ANESTY BoardはDiscordで動く顧客向けUI。
KOSAME Dev OrchestraはShellで動く開発管理の内部システム。

この v47 packは「裏側の状態をJSONで構造化する」ことを担います。
まずCLI表示 (v45)、次にMarkdown記録 (v46)、最後にJSONで全表現を統一 (v47) という設計です。

## JSONに含める項目

| フィールド | 説明 |
|-----------|------|
| `schemaVersion` | JSON構造のバージョン |
| `orchestraVersion` | Orchestraのバージョン (47.0.0) |
| `product` / `task` / `repo` / `commit` | ターゲット情報 |
| `stages[]` | 各ステージと状態 |
| `agents[]` | 各Agentと状態 |
| `dangerGates[]` | 危険ゲートと状態 (全BLOCKED) |
| `acceptance` | commit candidate / humanApprovalRequired / blockers |
| `nextAction` | 次にやること |
| `generatedAt` | 生成タイムスタンプ (ISO8601) |
| `dryRun` | 常にtrue |
| `humanApprovalRequired` | 常にtrue |
| `dangerousActionsDenied` | 禁止アクション一覧 |
| `discordWebhookSent` | 常にfalse (現時点未接続) |
| `externalRequestSent` | 常にfalse (外部通信なし) |

## 安全設計

- `dryRun: true` — 常にdry-run
- `humanApprovalRequired: true` — じゅんやさんのYES必須
- `discordWebhookSent: false` — Discord連携しない
- `externalRequestSent: false` — 外部HTTP通信なし
- Webサーバーを立てない
- Webhookを送信しない
- git add/commit/push/tag は Claude Code が実行しない

## 将来の拡張先

このJSONは以下の用途に使えるよう設計されています（現時点では未実装）:
- Discord通知 (Webhook)
- Web dashboard表示
- CI/CDステータス連携

現時点はJSON生成のみ。**Webhook送信は絶対にしません。**

## 使用方法

```bash
npm run pm-agent:visual-status-json-export
# または
node tools/dev-agent-visual-status-json-export-pack.js
```

smokeテスト:
```bash
npm run smoke:visual-status-json-export
```

## 承認ゲート一覧

以下はじゅんやさんの承認が必要なアクション:

- Secret / .env / API key の読取
- deploy / docker build / gcloud deploy
- git push / git tag
- customer data / 顧客情報の読取
- destructive delete (rm -rf, git reset --hard)

## 関連Pack

- v45.0.0 CLI Operation Board
- v46.0.0 Markdown Operation Report Export
