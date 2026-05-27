# Provider Safety Boundary v5.2.0

## Overview

This document defines the data-level and content safety rules for each provider in KOSAME Dev Orchestra.

## Data Levels

- **Level A**: Public information, generic code, error messages without secrets, synthetic fixtures. Safe for all providers.
- **Level B**: Partial private repo code, internal business logic, non-customer system design. Allowed for kosame, claude, cloudShell, human only.
- **Level C**: Customer data, insurance policy details, health check details, contracts, .env, API keys, Secrets. Allowed for kosame and human only.

## Blocked Input Keywords

The following keywords in any input summary trigger an automatic block for non-human providers:

- `.env`
- `API key`
- `Secret`
- `customer data`
- `insurance policy`
- `health check details`
- `contracts`

## Safety Check Flow

1. Determine the target provider.
2. Determine the data level of the input.
3. Scan the input summary for blocked keywords.
4. If data level is outside the provider's `allowedDataLevels`, reject.
5. If a blocked keyword is found, reject.
6. Otherwise, proceed — but human approval is still required for external providers.

## Safety Invariants

- No external provider may receive Level C data under any circumstance.
- Human approval is always required for external provider dispatch.
- Safety boundary checks run before pool compliance checks.
