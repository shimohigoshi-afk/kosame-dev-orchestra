# GitHub Actions Record (v0.8.2)

## 概要
GitHub Actions Record は、GitHub Actions で実行されたワークフローのステータスを構造化データとして記録するためのフォーマットである。

## 記録項目
- `workflowName`: 実行されたワークフロー名 (e.g., `verify.yml`)。
- `runId`: GitHub Actions の Run ID。
- `status`: `success`, `running`, `failed`, `cancelled`。
- `conclusion`: 最終的な判定。
- `url`: 実行詳細へのリンク。

## 目的
- `gh run list` の結果をパースして保存し、ローカルコンソールから CI の状況を把握する。
- CI 成功を「正本化（Release 可能な状態）」の条件として自動判定する。
- 失敗した場合は、Claude 補修またはこさめPM裁定のトリガーとする。
