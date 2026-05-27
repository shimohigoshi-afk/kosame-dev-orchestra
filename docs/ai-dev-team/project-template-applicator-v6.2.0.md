# Project Template Applicator v6.2.0

## Overview

The Project Template Applicator generates a standard KOSAME Dev Orchestra project structure for new or existing repositories.

## Standard Directories

- `docs/ai-dev-team` — release records and policy documents
- `tools` — pack tool implementations
- `smoke` — smoke test files
- `fixtures` — sample JSON fixtures

## Standard File Plan

For a project named `{slug}`:
- `docs/ai-dev-team/{slug}-release-record.md`
- `docs/ai-dev-team/{slug}-operation-standard.md`
- `tools/{slug}-pack.js`
- `smoke/dev-agent-{slug}-pack-smoke.js`
- `fixtures/{slug}.sample.json`

## Approval Gate Template

All four gates require human approval from じゅんやさん:
- `commitGate`: git commit
- `pushGate`: git push
- `tagGate`: git tag
- `deployGate`: deploy

## Functions

- `generateDirectoryPlan(projectName)` — list of directories to create
- `generateFilePlan(projectName, version)` — list of files to create
- `applyTemplate(input)` — full template with dirs, files, gates, scripts

## Safety Invariants

- Template generation is always `dryRun: true` — no files are actually created.
- All approval gates default to `requiresHumanApproval: true`.
