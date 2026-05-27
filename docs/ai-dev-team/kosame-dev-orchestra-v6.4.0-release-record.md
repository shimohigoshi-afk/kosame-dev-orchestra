# KOSAME Dev Orchestra v6.4.0 Issue/Ticket Runner Pack

## Purpose

This release introduces issue/ticket management for Dev Factory work, enabling task decomposition with assignable providers, status tracking, approval gates, completion conditions, and verification conditions.

## Ticket Types

implementation, bulk_draft, verify, review, deploy, release, design

## Approval-required Types

deploy and release tickets always have `humanApprovalRequired: true` with じゅんやさん as approver.

## Ticket Lifecycle

open → in_progress → awaiting_approval → verified → closed
(blocked at any stage if an obstacle is encountered)

## Release Value

v6.4.0 brings structured task management to Dev Factory operations, replacing ad-hoc task lists with auditable, approval-gated tickets.
