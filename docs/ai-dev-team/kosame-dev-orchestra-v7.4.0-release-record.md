# KOSAME Dev Orchestra v7.4.0 Release Record

## Release: v7.4.0 Repair Loop Controller

**Date:** 2026-05-30
**Status:** Released

## Summary

失敗時に、Claude修正 / Gemini整理 / Grok突破案 / こさめ裁定 / Human Approvalへ回す修正ループを生成する。
verify failure / syntax error / missing file / provider unavailable / safety block / human approval requiredを扱う。

## New Files

- `tools/repair-loop-controller-pack.js` — v7.4.0 Repair Loop Controller
- `smoke/dev-agent-repair-loop-controller-pack-smoke.js` — smoke test
- `fixtures/repair-loop-controller.sample.json` — fixture
- `docs/ai-dev-team/kosame-dev-orchestra-v7.4.0-release-record.md` — this record
- `docs/ai-dev-team/repair-loop-controller-v7.4.0.md` — feature doc

## Key Features

- failureType別のrepair routingテーブル
- syntax_error / verify_failure / missing_file / type_error / reference_error / npm_error → claude
- unclear_spec / spec_issue / safety_block / unknown_failure → kosame
- provider_unavailable → fallback provider (original providerのchain)
- human_approval_required → human
- repairPrompt: provider別のrepair指示文を自動生成
- repairSteps: 7ステップの修正ループを生成
- maxRetries: デフォルト3 (anesty_boardは1)
- 最大試行回数超過でescalation_required=trueに切り替え
- dryRun=true 固定 / humanApprovalRequired=true 固定

## Repair Routing Table

| failureType | repairProvider | fallback | escalation |
|---|---|---|---|
| verify_failure | claude | grok | kosame |
| syntax_error | claude | grok | kosame |
| missing_file | claude | grok | kosame |
| type_error | claude | grok | kosame |
| reference_error | claude | grok | kosame |
| npm_error | claude | kosame | human |
| unclear_spec | kosame | human | human |
| spec_issue | kosame | human | human |
| provider_unavailable | fallback | kosame | human |
| safety_block | kosame | human | human |
| human_approval_required | human | human | human |
| incomplete | claude | gemini | kosame |
| unknown_failure | kosame | human | human |

## smoke result

```
=== repair-loop-controller-pack smoke ===
  PASS: package version 7.4.0 or later
  PASS: smoke script exists
  PASS: release record exists
  PASS: fixture exists
  PASS: tool meta version 7.4.0
  PASS: dryRun true
  PASS: humanApprovalRequired true
  PASS: repairId, repairRoute, repairPrompt, repairSteps present
  PASS: repair loop routes syntax error to claude
  PASS: repair loop routes verify failure to claude
  PASS: repair loop routes unclear/spec issue to kosame
  PASS: repair loop routes spec issue to kosame/human
  PASS: repair loop routes provider unavailable to fallback provider
  PASS: repair loop routes missing_file to claude
  PASS: safety_block routes to kosame/human
  PASS: human_approval_required routes to human
  PASS: blockedDangerousActions includes git push / git tag / deploy / secret
  PASS: recommendedNextAction present
PASS: repair-loop-controller-pack
```
