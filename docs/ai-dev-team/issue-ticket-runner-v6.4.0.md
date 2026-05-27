# Issue/Ticket Runner v6.4.0

## Overview

Manages Dev Factory work as structured tickets with provider assignment, status tracking, approval gates, and verification conditions.

## Ticket Schema

| Field                 | Description                                    |
|-----------------------|------------------------------------------------|
| id                    | Unique identifier (auto-generated)             |
| title                 | Human-readable task title                      |
| type                  | One of the supported ticket types             |
| assignedProvider      | Provider responsible for this ticket           |
| status                | Current lifecycle status                       |
| humanApprovalRequired | true for deploy/release types                  |
| completionConditions  | List of conditions to mark the ticket done     |
| verificationConditions| List of verification steps (default: node+verify) |
| approvalGate          | { required, approver } — じゅんやさん for gated types |
| createdAt / updatedAt | ISO timestamps                                 |

## Operations

### createTicket(input)
Creates a new ticket with status `open`. Sets `humanApprovalRequired` and `approvalGate` based on ticket type.

### updateTicket(ticket, changes)
Updates allowed fields (status, assignedProvider, humanApprovalRequired, completionConditions). Resets invalid status to `open`.

### getTicketStatus(ticket)
Returns a summary with `isComplete`, `isBlocked`, `isAwaitingApproval` flags.

### buildRunnerPlan(tickets)
Groups tickets by status and identifies the next `open` ticket for processing.

## Safety Invariants

- deploy and release tickets always require human approval from じゅんやさん.
- Invalid status values are rejected and reset to `open`.
- Runner plan is always `dryRun: true` and `humanApprovalRequired: true`.
