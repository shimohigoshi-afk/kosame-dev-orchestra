# Product-specific Generator v6.3.0

## Overview

Generates work breakdowns, provider assignments, and verification plans tailored to each KOSAME product line.

## Product Configurations

Each product line defines:
- `primaryProvider` — main implementation provider
- `bulkProvider` — bulk draft/content provider
- `breakthroughProvider` — design/strategy provider
- `defaultRiskLevel` — low / medium / high / critical
- `requiredVerifications` — verification steps specific to the product
- `notes` — data boundary notes for the product

## Generated Outputs

### Work Breakdown (generateWorkBreakdown)
Six phases: design (kosame) → implementation (primary) → bulk_content (bulk) → breakthrough (breakthrough) → verify (cloudShell) → release (human). All phases except design require human approval.

### Provider Assignment (generateProviderAssignment)
Returns: primary, bulk, breakthrough, execution (cloudShell), approval (human), pm (kosame).

### Verification Plan (generateVerificationPlan)
Returns product-specific verification steps, all marked required, with `humanApprovalRequired: true`.

## Safety Invariants

- anesty_board: primary is always kosame — never dispatched to external providers.
- cloud_run_launch_pack: deploy operations are always Human Approval gated.
- All products: release phase owner is always human.
