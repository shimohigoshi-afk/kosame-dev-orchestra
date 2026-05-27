# KOSAME Dev Orchestra v6.0.0 Dev Factory MVP

## Purpose

v6.0.0 delivers the Dev Factory MVP — a product-line-aware, safety-gated development factory that orchestrates multi-provider AI work from task intake through to human-approved release.

## Inputs

| Field              | Description                                      |
|--------------------|--------------------------------------------------|
| projectName        | Project identifier                               |
| repoPath           | Local repository path                            |
| taskGoal           | Plain-text description of the development goal   |
| productLine        | One of the supported product lines               |
| riskLevel          | low / medium / high / critical                   |
| preferredProviders | Ordered list of preferred provider names         |

## Outputs

| Field                  | Description                                       |
|------------------------|---------------------------------------------------|
| workBreakdown          | Phase-by-phase plan with owner and approval flag  |
| providerAssignments    | Primary, bulk, breakthrough, execution, PM        |
| sanitizedPromptPackets | Safety check result and blocked keyword report    |
| verificationPlan       | Required verification steps                       |
| humanApprovalPacket    | Approval context for じゅんやさん                 |
| blockedDangerousActions| Full list of gated operations                     |
| recommendedNextAction  | Single next-step recommendation                   |

## Supported Product Lines

- `sales_dx`, `email_reply`, `ai_bot`, `backoffice`, `anesty_board`, `cloud_run_launch_pack`

## Safety Requirements

- `dryRun`: true always
- `humanApprovalRequired`: true always
- Customer data, Secret, .env, API keys, insurance policy, health check info, personal names are blocked for all external providers
- git commit / push / tag / deploy require Human Approval
- Destructive actions are listed in `blockedDangerousActions` and never executed automatically
- DeepSeek and Kimi receive only Level A (sanitized, anonymous) data
- じゅんやさんは最終YESのみ。作業員に戻さない。

## Release Value

v6.0.0 completes Phase 1 of KOSAME Dev Orchestra as a code-producing development factory, enabling こさめ副社長 to orchestrate multi-provider AI work safely and systematically across all KOSAME product lines.
