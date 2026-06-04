# KOSAME Dev Orchestra Cross-Product Risk Router v58.0.0

## 概要

複数プロダクトにまたがる依頼を、Claude / Gemini / Grok / Human / External SEのどこに回すか判定するpackです。

## ルーティング判定表

| 条件 | 割り当て先 |
|------|----------|
| docs / smoke / fixture のみ | CLAUDE_CODE |
| 長文レビュー / bulk summarization | GEMINI_REVIEW |
| breakthrough / alternative proposal | GROK_REVIEW |
| Secret access | HUMAN_APPROVAL |
| deploy required | HUMAN_APPROVAL (+EXTERNAL_SE_REVIEW) |
| customer data access | KOSAME_PM + HUMAN_APPROVAL |
| insurance data access | KOSAME_PM + HUMAN_APPROVAL + EXTERNAL_SE_REVIEW |
| low confidence + high risk | HOLD |

## ROUTES定数

- `CLAUDE_CODE` / `GEMINI_REVIEW` / `GROK_REVIEW`
- `KOSAME_PM` / `HUMAN_APPROVAL` / `EXTERNAL_SE_REVIEW` / `HOLD`

## 使用方法

```bash
npm run pm-agent:cross-product-risk-router
npm run smoke:cross-product-risk-router
```
