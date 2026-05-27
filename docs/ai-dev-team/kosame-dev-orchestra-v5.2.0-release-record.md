# KOSAME Dev Orchestra v5.2.0 Provider Safety Boundary Pack

## Purpose

This release defines per-provider safety boundaries, blocking unsafe data from reaching external providers.

## Safety Boundary Table

| Provider   | Allowed Data Levels | Secrets | Customer Data | Requires Approval |
|------------|---------------------|---------|---------------|-------------------|
| kosame     | A, B, C             | No      | Yes           | No                |
| claude     | A, B                | No      | No            | Yes               |
| gemini     | A                   | No      | No            | Yes               |
| grok       | A                   | No      | No            | Yes               |
| deepseek   | A                   | No      | No            | Yes               |
| kimi       | A                   | No      | No            | Yes               |
| cloudShell | A, B                | No      | No            | Yes               |
| human      | A, B, C             | Yes     | Yes           | No                |

## Blocked Inputs

.env values, API keys, Secrets, customer data, insurance policy details, health check details, and contracts are blocked for all external providers.

## Release Value

v5.2.0 prevents accidental data leakage to external providers by enforcing boundary checks before every dispatch.
