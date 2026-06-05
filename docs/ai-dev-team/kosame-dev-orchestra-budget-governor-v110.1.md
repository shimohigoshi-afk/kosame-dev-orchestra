# KOSAME Dev Orchestra — Budget Governor v110.1.0

## 概要

コスト意識に基づくモデル選択を強制するガバナー。
高コストモデルへのエスカレーションをサイレントに許可しない。
予算の段階に応じて自動的にモデル選択とHuman承認要件を制御する。

---

## 予算目標

| 項目 | 値 |
|------|-----|
| プロジェクト予算目標 | 1,500 JPY |
| プロジェクト予算ハードキャップ | 2,000 JPY |

---

## 段階別動作

| 使用率 | 状態 | 動作 |
|--------|------|------|
| 0〜80% | `OK` | 低コストモデル推奨・許可。高コストモデルはHuman確認のみ |
| 80〜90% | `WARNING` | 低コストモデル優先。高コストモデルはブロック＋Human承認要求 |
| 90〜100% | `NEAR_CAP` | 高コストモデルロック。Human承認なしにエスカレーション不可 |
| 100%以上 | `OVER_BUDGET` | 全エスカレーションブロック。Human承認必須 |

---

## モデルティア

| ティア | モデル例 |
|--------|---------|
| cheap | gemini-flash, gemini-pro, gpt-3.5-turbo, grok-1 |
| standard | claude-haiku, gpt-4o-mini, grok-2 |
| expensive | claude-opus, claude-sonnet, gpt-4o, gpt-4-turbo, grok-3 |

※ DeepSeek/Kimi はティア管理の対象外（Sanitized Handoff Guard でブロック）

---

## 設定可能な閾値

| パラメータ | デフォルト |
|-----------|----------|
| `projectBudgetTargetJpy` | 1500 |
| `projectBudgetHardCapJpy` | 2000 |
| `warningAtPercent` | 80 |
| `lockExpensiveModelsAtPercent` | 90 |
| `requireHumanApprovalAtPercent` | 100 |

---

## 出力フィールド

| フィールド | 説明 |
|-----------|------|
| `budgetStatus` | OK / WARNING / NEAR_CAP / OVER_BUDGET |
| `recommendedModelTier` | cheap / standard / expensive |
| `escalationAllowed` | エスカレーション可否 |
| `humanApprovalRequired` | Human承認要否 |
| `approvalMessage` | 承認を促す1行メッセージ |
| `blockedModels` | ブロックされたモデルリスト |
| `fallbackToCheapModels` | 安価モデルへのフォールバック要否 |
| `dangerousActionsDenied` | 常に `true` |

---

## 使用方法

```bash
npm run pm-agent:budget-governor-pack
npm run smoke:budget-governor-pack
```

---

## バージョン

- v110.1.0 — 初版、2026-06-05
