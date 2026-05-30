# KOSAME Dev Orchestra v7.5.0 Release Record

## Release: v7.5.0 Practical Dev Factory Loop

**Date:** 2026-05-30
**Status:** Released

## Summary

タスク投入 → Runtime正規化 → provider振分 → 実行パケット生成 → 結果レビュー → 修正ループ → 承認パケット生成まで一周させる。
v7.1.0〜v7.4.0の全パックを統合したフルループ。

## New Files

- `tools/practical-dev-factory-loop-pack.js` — v7.5.0 Practical Dev Factory Loop
- `smoke/dev-agent-practical-dev-factory-loop-pack-smoke.js` — smoke test
- `fixtures/practical-dev-factory-loop.sample.json` — fixture
- `docs/ai-dev-team/kosame-dev-orchestra-v7.5.0-release-record.md` — this record
- `docs/ai-dev-team/practical-dev-factory-loop-v7.5.0.md` — feature doc

## Integrated Packs

- v7.0.0 practical-dev-factory-runtime-pack
- v7.1.0 provider-prompt-router-real-use-pack
- v7.2.0 task-execution-packet-generator-pack
- v7.3.0 result-import-review-pack
- v7.4.0 repair-loop-controller-pack

## Loop Steps

1. Runtime normalization (v7.0.0)
2. Provider routing (v7.1.0)
3. Level C safety gate
4. Execution packet generation (v7.2.0)
5. Result import & review (v7.3.0)
6. Repair loop (v7.4.0) — if failure detected
7. Final approval packet generation

## Outputs

- loopId, runtimePacket, providerRoute, executionPacket
- importedResult, reviewDecision, repairLoop
- finalApprovalPacket (commit/push/tag/deploy gates)
- blockedDangerousActions, recommendedNextAction
- dryRun=true, humanApprovalRequired=true

## Safety Rules

- dryRun=true 固定
- humanApprovalRequired=true 固定
- Level C data → external provider 自動ブロック → kosame/human only
- implementation → claude
- draft / docs / bulk → gemini
- strategy / breakthrough → grok
- review / safety / final / critical → kosame
- deploy / git push / git tag / secret / billing / destructive action → human approval
- DeepSeek/Kimi: Level A + anonymized only
- じゅんやさんは最終YESのみ。作業員に戻さない。

## smoke result

```
=== practical-dev-factory-loop-pack smoke ===
  PASS: package version 7.5.0 or later
  PASS: scripts exist
  PASS: release record exists
  PASS: fixture exists
  PASS: tool meta version 7.5.0
  PASS: all v7.1.0-v7.4.0 release records exist
  PASS: all v7.1.0-v7.4.0 smoke scripts exist
  PASS: all v7.1.0-v7.4.0 fixtures exist
  PASS: dryRun true
  PASS: humanApprovalRequired true
  PASS: loopId present
  PASS: loop output includes runtimePacket / executionPacket / importedResult / repairLoop / finalApprovalPacket
  PASS: executionPacket includes allowedFiles / deniedFiles / verifyCommands / doneCriteria / forbiddenActions
  PASS: finalApprovalPacket includes commit/push/tag gates
  PASS: blockedDangerousActions includes git push / git tag / deploy / secret
  PASS: success loop builds correctly
  PASS: failure loop generates repairLoop
  PASS: Level C blocks external provider
  PASS: product lines include sales_dx and anesty_board
  PASS: recommendedNextAction present
  PASS: provider route works (implementation → claude)
PASS: practical-dev-factory-loop-pack
```
