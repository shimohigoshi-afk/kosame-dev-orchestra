# KOSAME Dev Orchestra Product Feedback Capture v103.0.0

## Purpose
Capture pilot/product feedback without reading real customer data.

## Data Policy
- NO real customer PII
- NO Gmail data
- NO insurance/health data
- Feedback source: dry-run outputs, mock testing, internal review, approved pilot notes

## Feedback Categories
- usability, performance, reliability, feature_gap
- security_concern, data_boundary_issue
- pmf_signal, revenue_signal, operational_friction, guardian_issue

## Severity Levels
critical → high → medium → low

## Feedback Item Structure
- product, category, severity
- description, productImpact
- revisionSuggestion
- pmfSignal, revenueSignal
- dataFromRealCustomers: always false

## Tool
`tools/dev-agent-product-feedback-capture-pack.js`

## Version
103.0.0
