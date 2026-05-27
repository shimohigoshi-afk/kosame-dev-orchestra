# KOSAME Dev Orchestra v5.8.0 AI Worker Queue Pack

## Purpose

This release introduces a priority-based worker queue for AI tasks, enabling ordered dispatch with depth limits and status tracking.

## Queue Policy

- Max queue depth: 10
- Priority levels: critical → high → normal → low
- All dispatches require human approval
- Blocked statuses: paused, blocked, awaiting_human

## Operations

- `enqueue(queue, item)` — adds a task, sorted by priority
- `dequeue(queue)` — removes the next dispatchable task
- `getQueueStatus(queue)` — returns totals by priority level

## Release Value

v5.8.0 allows こさめ副社長 to manage multiple concurrent AI work items in a structured queue rather than dispatching ad-hoc, reducing coordination overhead.
