# KOSAME Dev Orchestra Markdown Operation Report Export v46.0.0

## 概要

CLI Operation Board (v45) の内容をMarkdownレポートとして保存できるpackです。
作業記録・引継ぎ・こさめ/GPTレビュー用に、Operation Boardの状態をMarkdownに書き出します。

## 役割定義

| レイヤー | 説明 |
|---------|------|
| **ANESTY Board** | Discordで魅せる表側のプロダクト |
| **KOSAME Dev Orchestra** | Shellで動かす裏側の開発部門 |

この v46 packは「裏側の記録」を担当します。
Shellで作業した結果をMarkdownファイルに書き出し、こさめ/GPTが確認・じゅんやさんが最終YESする流れを支えます。

## 出力先

```
reports/orchestra/YYYYMMDD_<taskSlug>_report.md
```

**smokeでは `dryRun: true` のため実ファイルは書き込みません。**
`dryRun: false` を明示した場合のみ `reports/orchestra/` に書き込みます。

## Markdownに含める項目

| セクション | 内容 |
|-----------|------|
| 作業タイトル | # heading |
| Generated / Orchestra Version / dryRun | メタ情報 |
| Target | Product / Task / Repo / Commit |
| Responsible AI | 担当Agent一覧 |
| Stage Summary | ステージと状態のテーブル |
| Danger Gates | 全ゲートの状態 |
| Verify Result | `npm run verify` の結果 |
| Acceptance | commit candidate / human approval required / blockers |
| Next Action | 次にやること |
| Handoff Note | 引継ぎメモ |
| Dangerous Actions Denied | 禁止アクション一覧 |

## 安全設計

- `dryRun: true` がデフォルト — 明示的に `false` にしない限り書き込まない
- 書き込み先は `reports/orchestra/` のみ
- `humanApprovalRequired: true` — 常に真
- git add/commit/push/tag は Claude Code が実行しない
- じゅんやさんが最終YES担当

## 使用方法

```bash
npm run pm-agent:markdown-operation-report-export
# または
node tools/dev-agent-markdown-operation-report-export-pack.js
```

smokeテスト:
```bash
npm run smoke:markdown-operation-report-export
```

## Discord連携

現時点ではDiscord連携しません。
将来の拡張先として v47 Visual Status JSON Exportが基盤を提供します。

## 関連Pack

- v45.0.0 CLI Operation Board
- v47.0.0 Visual Status JSON Export
