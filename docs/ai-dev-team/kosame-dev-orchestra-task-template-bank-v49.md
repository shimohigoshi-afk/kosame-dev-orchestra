# KOSAME Dev Orchestra Operation Board Task Template Bank v49.0.0

## 概要

よくある開発依頼をテンプレ化し、Operation Boardから次タスクを選びやすくするpackです。
9種類のテンプレートを内蔵し、各テンプレートには許可ファイル・禁止ファイル・禁止コマンド・検証手順・完了基準が定義されています。

## テンプレート一覧

| templateId | タイトル | 推奨Agent |
|------------|---------|----------|
| docs_update | docs更新 (ai-dev-team/*.md) | Claude / Kuro |
| smoke_addition | 新smokeテスト追加 | Claude / Kuro |
| readme_update | README.md更新 | Claude / Kuro |
| runbook_update | runbook更新 | Claude / Kuro |
| cloudrun_preflight_update | Cloud Run preflight pack更新 | Claude / Kuro |
| acceptance_gate_update | Acceptance Gate pack更新 | Claude / Kuro |
| operation_board_update | Operation Board pack更新 | Claude / Kuro |
| product_repo_controlled_task | 外部productリポへのcontrolled task | Claude / Kuro |
| handoff_doc_update | Handoff doc更新 | Claude / Kuro |

## 各テンプレートの構造

各テンプレートに以下のフィールドが含まれます:

| フィールド | 説明 |
|-----------|------|
| `templateId` | 一意のID |
| `title` | タスクの説明 |
| `productType` | 対象リポのタイプ |
| `recommendedAgent` | 推奨担当Agent |
| `allowedFiles` | 触ってよいファイル |
| `forbiddenFiles` | 絶対に触ってはいけないファイル |
| `allowedCommands` | 実行してよいコマンド |
| `forbiddenCommands` | 実行禁止コマンド |
| `verificationCommands` | 検証コマンド |
| `dangerGates` | 危険ゲート (全BLOCKED) |
| `humanApprovalRequired` | 常にtrue |
| `expectedChangedFiles` | 想定変更ファイル |
| `doneCriteria` | 完了基準 |
| `rollbackInstruction` | ロールバック手順 |
| `commitStopRule` | commitストップルール |

## 全テンプレート共通の禁止コマンド

- git add / git commit / git push / git tag
- git reset --hard / git clean -f / git checkout -- .
- deploy / docker build / gcloud deploy
- npm run deploy
- rm -rf
- cat .env / cat secrets / printenv

## 安全設計

- `humanApprovalRequired: true` — 全テンプレートで常にtrue
- `commitStopRule` — git addの前で必ず停止
- じゅんやさんのYES前にgit操作を行わない

## 使用方法

```bash
npm run pm-agent:task-template-bank
npm run smoke:operation-board-task-template-bank
```

コードから使用:
```js
const { getTemplate } = require('./tools/dev-agent-operation-board-task-template-bank-pack');
const tpl = getTemplate('docs_update');
```

## 関連Pack

- v48.0.0 Practical Operation Board Display
- v50.0.0 Practical Build Line
