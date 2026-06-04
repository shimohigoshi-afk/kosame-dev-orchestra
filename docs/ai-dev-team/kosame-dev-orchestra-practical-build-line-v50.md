# KOSAME Dev Orchestra Practical Build Line v50.0.0

## 概要

KOSAME Dev Orchestraの日常運用ラインを1つにまとめるpackです。

## 運用フロー

```
1. Operation Board表示 (v48)
       ↓
2. Task Template選定 (v49)
       ↓
3. Claude Prompt生成
       ↓
4. Safety Gate確認
       ↓
5. Smoke/Verify計画
       ↓
6. Acceptance Gate
       ↓
7. Human YES待ち → git add/commit/push (じゅんやさん実行)
```

## 出力構造

| フィールド | 説明 |
|-----------|------|
| `operationBoard` | 現在のOperation Board状態 |
| `selectedTaskTemplate` | 選択されたTask Template |
| `claudePromptPacket` | Claude Codeへ投入するprompt |
| `safetyGate` | 安全ゲート結果 |
| `verificationPlan` | 検証計画 |
| `acceptanceGate` | 受入ゲート (commitCandidate / blockers) |
| `humanApprovalPacket` | じゅんやさん承認用パケット |
| `nextAction` | 次にやること |

## Safety Gate ロジック

| 条件 | safetyGate.passed | commitCandidate |
|------|------------------|----------------|
| blockers なし | true | true |
| secretTouched = true | false | false |
| deployInScope = true | false | false |
| botJsTouched = true | false | false |

## 重要設計原則

- `dryRun: true` — 常にdry-run。実commitなし
- `humanApprovalRequired: true` — じゅんやさんのYES必須
- `discordWebhookSent: false` — Discord連携なし
- `externalRequestSent: false` — 外部通信なし
- git add/commit/push/tag は Claude Code が絶対に実行しない

## 使用方法

```bash
npm run pm-agent:practical-build-line
npm run smoke:practical-build-line
```

コードから使用:
```js
const { buildPracticalBuildLine } = require('./tools/dev-agent-practical-build-line-pack');
const line = buildPracticalBuildLine({ templateId: 'docs_update' });
console.log(line.claudePromptPacket.prompt);
```

## じゅんやさんを作業員に戻さない原則

- Claude Codeは実装担当。commit/push/tagはしない
- こさめ/GPTがAcceptance Gateを担当
- じゅんやさんは最終YES担当のみ
- git操作 / deploy / secretはじゅんやさんだけが実行できる

## 承認ゲート

以下はじゅんやさんの承認が必要:
- git add / git commit / git push / git tag
- deploy / docker build / gcloud deploy
- Secret / .env / API key 読取
- customer data / 個人情報 読取
- rm -rf / git reset --hard

## 関連Pack

- v45.0.0 CLI Operation Board
- v48.0.0 Practical Operation Board Display
- v49.0.0 Operation Board Task Template Bank
