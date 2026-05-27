# AI Worker Queue v5.8.0

## Overview

The AI Worker Queue manages a prioritized list of AI tasks awaiting dispatch to providers.

## Queue Item Schema

| Field                 | Description                          |
|-----------------------|--------------------------------------|
| id                    | Unique task identifier               |
| provider              | Target provider                      |
| taskType              | implementation / draft / bugfix etc. |
| priority              | critical / high / normal / low       |
| dataLevel             | A / B / C                            |
| status                | queued / dispatched / blocked        |
| humanApprovalRequired | Always true                          |
| createdAt             | ISO timestamp                        |

## Operations

### enqueue(queue, item)
Adds an item to the queue sorted by priority. Rejects if `maxQueueDepth` (10) is reached.

### dequeue(queue)
Returns the highest-priority item that is not in a blocked status. Marks it as `dispatched`.

### getQueueStatus(queue)
Returns `{ total, byPriority }` for monitoring.

## Safety Invariants

- No item may be dequeued with a blocked status.
- Human approval is required before any dequeued item is dispatched to an external provider.
- Queue depth limit prevents runaway task accumulation.
