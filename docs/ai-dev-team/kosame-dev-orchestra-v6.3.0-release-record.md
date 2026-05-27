# KOSAME Dev Orchestra v6.3.0 Product-specific Generator Pack

## Purpose

This release provides per-product-line generation of work breakdowns, provider assignments, and verification plans — tailored to the specific requirements of each KOSAME product.

## Supported Product Lines

| Product Line          | Primary   | Bulk   | Risk Level |
|-----------------------|-----------|--------|------------|
| sales_dx              | claude    | gemini | medium     |
| email_reply           | claude    | gemini | medium     |
| ai_bot                | claude    | gemini | low        |
| backoffice            | claude    | gemini | low        |
| anesty_board          | kosame    | gemini | critical   |
| cloud_run_launch_pack | claude    | gemini | high       |

## Key Safety Rule

anesty_board is always routed to kosame (internal only). No external provider may receive anesty_board tasks.

## Release Value

v6.3.0 enables こさめ副社長 to generate product-appropriate plans with a single call, without manually specifying provider assignments and verification steps.
