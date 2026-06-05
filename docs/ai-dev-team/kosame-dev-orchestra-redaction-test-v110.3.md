# KOSAME Dev Orchestra — Redaction Test Pack v110.3.0

## Purpose

Test whether content is safe to hand off to external/risky providers (DeepSeek, Kimi).

## Detected Sensitive Types

`api_key`, `secret`, `env_line`, `token`, `github_credential`, `email_address`, `phone_number`, `customer_data`, `insurance_data`, `health_data`, `billing_data`, `contract_data`, `raw_log_identifier`, `unpublished_strategy`

## Allowed After Redaction

`abstracted_error_summary`, `anonymized_code_snippet`, `pseudocode`, `generic_architecture_question`, `public_library_behavior_question`

## Rules

- Any detected sensitive type → `redactionPassed: false`
- DeepSeek/Kimi + `sanitized: false` → always blocked
- DeepSeek/Kimi `finalDecisionAllowed: false` always
- `humanApprovalRequired: true` for external risk providers or when sensitive data detected

## Integration

Complements Sanitized Handoff Guard (v110.1).

## Tool

`tools/dev-agent-redaction-test-pack.js`
