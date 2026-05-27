# KOSAME Dev Orchestra v4.0.0 Practical Operating Console Standard

## Purpose

v4.0.0 defines the Practical Operating Console standard for KOSAME Dev Orchestra.

The goal is to let こさめ副社長 support Cloud Shell operations by reading state, making practical judgments, proposing safe commands, enforcing approval gates, and preparing handoff summaries without turning じゅんやさん back into a copy-paste worker.

## Core Roles

- じゅんやさん: final human approval for dangerous or irreversible actions
- こさめ副社長: state reading, judgment, safe command proposal, approval gate design, handoff support
- Claude係長: implementation and repair
- Gemini課長: bulk drafting and expansion when available
- Cloud Shell: verification and controlled execution
- GitHub Actions: release readiness evidence

## Practical Operating Console Scope

The Practical Operating Console supports:

- status
- commit-check
- push-check
- release-check
- dispatch
- approval-board
- handoff
- next action

## Standard Operation Loop

1. 状態読取
2. 判断
3. 安全コマンド提案
4. 承認ゲート
5. 実行結果レビュー
6. 次担当振り分け
7. 引継ぎ

## Safety Defaults

All generated console outputs must default to:

- dryRun: true
- humanApprovalRequired: true for git commit, git push, git tag, deploy, release, Secret handling, customer data handling, and production-impacting actions

## Approval Gate Boundary

The following actions require human approval:

- git push
- git tag
- deploy
- release
- Cloud Run production changes
- Secret handling
- .env handling
- API key handling
- customer data handling
- paid API execution
- destructive deletion

## Forbidden or Denied Actions

The console must not execute or generate unsafe direct execution flows for:

- rm -rf
- git reset --hard
- git clean
- Secret / .env / API key閲覧
- deploy without approval
- gcloud run deploy without approval
- docker build as an automatic step
- external API execution as an automatic step
- paid API execution as an automatic step
- unapproved git push
- unapproved git tag

## Safe Command Proposal Boundary

The console may propose, but not execute without human approval where applicable:

- git status
- git log
- git diff --name-only
- node --check
- npm run verify
- gh run list
- git add package.json docs/ai-dev-team tools smoke fixtures
- git commit -m "..."
- git push origin main
- git tag -a ...
- git push origin <tag>

## v4.0.0 Standard

v4.0.0 is the first practical operating console foundation where こさめ副社長 can help manage the development loop:

状態読取 → 判断 → 安全コマンド提案 → 承認ゲート → 実行結果レビュー → 次担当振り分け → 引継ぎ

The system must keep じゅんやさん as the final approver, not the manual operator.
