# KOSAME Dev Orchestra v5.4.0 Provider Prompt Template Pack

## Purpose

This release provides standardized prompt templates for each provider, ensuring consistent role framing and data boundary enforcement at the prompt level.

## Provider Templates

| Provider  | Role                   | Allowed Data Levels |
|-----------|------------------------|---------------------|
| claude    | Implementation engineer | A, B               |
| gemini    | Bulk draft specialist   | A                  |
| grok      | Breakthrough analyst    | A                  |
| deepseek  | Fallback code proposer  | A                  |
| kimi      | Long context summarizer | A                  |
| kosame    | PM decision maker       | A, B, C            |

## Release Value

v5.4.0 eliminates ad-hoc prompt construction by providing validated templates that enforce role and data level constraints before any prompt reaches an external provider.
