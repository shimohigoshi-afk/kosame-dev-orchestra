# Provider Health Auto Reporter v5.6.0

## Overview

The health auto reporter evaluates each provider's success rate and latency, producing a structured status report.

## Evaluated Providers

kosame, claude, gemini, grok, deepseek, kimi, cloudShell, human

## Evaluation Logic

For each provider, `evaluateHealth(stats)` computes:

1. If `successRate < 0.50` → `critical`
2. Else if `successRate < 0.80` → `warning`
3. If `latencyMs > 15,000` → `critical` (overrides lower severity)
4. Else if `latencyMs > 5,000` → `warning` (if not already critical)
5. Otherwise → `healthy`

## Report Usage

Call `generateReport(providerStats)` to receive:
- `report`: per-provider health evaluation
- `criticalProviders`: list of providers in critical state
- `humanApprovalRequired`: always true

## Safety Invariants

- The reporter is read-only — it never dispatches tasks or modifies provider state.
- Critical provider reports should trigger fallback routing review by こさめ副社長.
