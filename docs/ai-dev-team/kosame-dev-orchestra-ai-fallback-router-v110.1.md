# KOSAME Dev Orchestra — AI Fallback Router v110.1.0

## 概要

AI プロバイダーが停止・タイムアウト・予算超過・応答不可になったとき、次に誰が引き継ぐかを定義するルーティングポリシー。

---

## 通常ルート (Primary Route)

| 役割 | プロバイダー |
|------|-------------|
| 設計・指示・リスク判断 | GPT / KOSAME |
| 低コスト一括作業・初稿・大量読み込み | Gemini |
| 洗練・修正・実装仕上げ | Claude |
| レビュー・次の指示生成 | GPT / KOSAME |
| 不可逆操作の最終承認 | Human（じゅんやさん） |

---

## フォールバックルート (Fallback Routes)

| 失敗したプロバイダー | 代替プロバイダー |
|---------------------|----------------|
| Gemini | Grok → GPT |
| Claude | GPT → Grok → Gemini |
| GPT | Gemini → Grok（advisory only、最終判断はHuman待ち） |
| 全プロバイダー失敗 | DeepSeek / Kimi（sanitized advisory only、最終判断不可） |

---

## ブロックポリシー

- **DeepSeek / Kimi** は最終判断、シークレット処理、顧客データ処理、本番デプロイ判断、push/tag/commit承認、課金判断を行ってはならない。
- ブロック対象操作: `secret`, `customer_data`, `deploy`, `push`, `tag`, `billing`, `production`, `commit`, `insurance_data`, `health_data`

---

## 出力フィールド

| フィールド | 説明 |
|-----------|------|
| `primaryRoute` | 通常ルート定義 |
| `fallbackRoutes` | 代替プロバイダーリスト |
| `providerFailureReasons` | 失敗したプロバイダーと理由 |
| `allowedFallbackProviders` | 許可された代替プロバイダー |
| `blockedFallbackProviders` | ブロックされたプロバイダー |
| `humanApprovalRequired` | 常に `true` |
| `dangerousActionsDenied` | 常に `true` |
| `finalDecisionPolicy` | DeepSeek/Kimiの最終判断禁止ポリシー |

---

## 使用方法

```bash
npm run pm-agent:ai-fallback-router-pack
npm run smoke:ai-fallback-router-pack
```

---

## 設計原則

- dryRun: true（実際のAPI呼び出しは行わない）
- realProductActionsExecuted: false
- humanApprovalRequired: true（常に）
- v110.0.0 Core は変更しない

---

## バージョン

- v110.1.0 — 初版、2026-06-05
