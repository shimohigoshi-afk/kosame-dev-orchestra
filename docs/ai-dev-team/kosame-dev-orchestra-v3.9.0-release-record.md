# KOSAME Dev Orchestra v3.9.0 Release Record

## バージョン
v3.9.0 — Kosame Handoff Auto Generator Pack

## リリース日
2026-05-27

## 目的
現在状態から次チャットセッション用の引継ぎメモを自動生成する。concise（短い）とdetailed（詳細）の2トーンを提供し、Claude係長・Gemini課長・じゅんやさんそれぞれへの情報を網羅する。

---

## 実装ファイル

### ツール (tools/)
| ファイル | 説明 |
|---|---|
| `tools/kosame-handoff-auto-generator.js` | 2トーンの引継ぎメモ自動生成 |

### スモーク (smoke/)
| ファイル | アサーション数 |
|---|---|
| `smoke/dev-agent-kosame-handoff-auto-generator-smoke.js` | 41 |
| `smoke/dev-agent-v3.9.0-release-record-smoke.js` | リリース確認 |

---

## Handoff セクション

| セクション | 説明 |
|---|---|
| `currentVersion` | 現在のpackage.json version |
| `currentHead` | 現在のHEAD commit |
| `latestTag` | 最新tag |
| `actionsStatus` | GitHub Actions状態 |
| `completedWork` | 完了した作業リスト |
| `uncommittedWork` | 未コミット作業リスト |
| `nextRecommendedAction` | 次推奨アクション |
| `riskNotes` | リスクノート |
| `forbiddenActions` | 禁止アクションリスト |
| `nextClaudePromptSummary` | Claude係長への次プロンプト要約 |
| `nextGeminiFallbackSummary` | Gemini課長フォールバック要約 |
| `humanApprovalStatus` | 承認状態 |

---

## Tone Profiles

| Tone | 説明 |
|---|---|
| `concise` | 1画面で読める短い引継ぎ。version/head/tag/actions/完了/未コミット/次アクション/リスク |
| `detailed` | はしょりなし詳細引継ぎ。全セクション + Gemini/Claude別情報 + 禁止アクション全リスト |

---

## readyForHandoff 条件

- `uncommittedWork.length === 0`
- `riskNotes` にFAILが含まれない
