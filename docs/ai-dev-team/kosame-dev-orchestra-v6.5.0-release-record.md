# KOSAME Dev Orchestra v6.5.0 Provider Prompt Router CLI

## Purpose

v6.5.0 is the final release of the v6 series. It delivers a CLI-style prompt router that takes task parameters and produces a complete provider selection, prompt packet, safety boundary check, verification plan, and human approval packet — in a single call.

## Inputs

| Field             | Description                                         |
|-------------------|-----------------------------------------------------|
| taskType          | implementation / draft / strategy / etc.            |
| productLine       | KOSAME product line                                 |
| riskLevel         | low / medium / high / critical                      |
| dataLevel         | A / B / C                                           |
| preferredProvider | Optional preferred provider                         |
| goal              | Plain-text task goal                                |

## Outputs

| Field                 | Description                                        |
|-----------------------|----------------------------------------------------|
| selectedProvider      | Chosen provider                                    |
| fallbackProviders     | Ordered fallback list                              |
| promptPacket          | Ready-to-use prompt with role framing              |
| safetyBoundary        | Safety check result                                |
| verificationPlan      | Required verification steps                        |
| humanApprovalRequired | Always true                                        |
| blockedActions        | Full blocked action list                           |
| recommendedNextAction | Single next-step string                            |

## Safety Requirements

- dryRun: true always
- humanApprovalRequired: true always
- Level C → kosame only
- critical risk → kosame review
- API key / Secret / customer data / .env / insurance / health check / personal name → blocked for external providers
- DeepSeek / Kimi → Level A only, fully sanitized
- じゅんやさんは最終YESのみ — 作業員に戻さない
- v7.0.0には進まない

## Release Value

v6.5.0 completes the KOSAME Dev Orchestra v6 series as a full-featured, safety-gated, multi-provider development factory CLI. こさめ副社長 can now route any task to the correct provider with a single structured call.
