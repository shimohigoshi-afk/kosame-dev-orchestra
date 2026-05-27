'use strict';

const TOOL_META = {
  version: '5.8.0',
  title: 'AI Worker Queue Pack',
  slug: 'ai-worker-queue-pack'
};

const QUEUE_POLICY = {
  maxQueueDepth: 10,
  priorityLevels: ['critical', 'high', 'normal', 'low'],
  requiresApprovalForDispatch: true,
  blockedStatuses: ['paused', 'blocked', 'awaiting_human']
};

function createQueueItem(input = {}) {
  return {
    id: input.id || `task-${Date.now()}`,
    provider: input.provider || 'claude',
    taskType: input.taskType || 'implementation',
    priority: input.priority || 'normal',
    dataLevel: input.dataLevel || 'A',
    status: 'queued',
    humanApprovalRequired: true,
    createdAt: new Date().toISOString()
  };
}

function enqueue(queue = [], item = {}) {
  if (queue.length >= QUEUE_POLICY.maxQueueDepth) {
    return { ok: false, reason: 'queue depth limit reached', queue };
  }
  const newItem = createQueueItem(item);
  const sorted = [...queue, newItem].sort((a, b) => {
    const pa = QUEUE_POLICY.priorityLevels.indexOf(a.priority);
    const pb = QUEUE_POLICY.priorityLevels.indexOf(b.priority);
    return pa - pb;
  });
  return { ok: true, item: newItem, queue: sorted };
}

function dequeue(queue = []) {
  if (queue.length === 0) {
    return { ok: false, reason: 'queue is empty', item: null, queue };
  }
  const [next, ...remaining] = queue;
  if (QUEUE_POLICY.blockedStatuses.includes(next.status)) {
    return { ok: false, reason: `item status is ${next.status}`, item: next, queue };
  }
  return { ok: true, item: { ...next, status: 'dispatched' }, queue: remaining };
}

function getQueueStatus(queue = []) {
  const byPriority = {};
  for (const level of QUEUE_POLICY.priorityLevels) {
    byPriority[level] = queue.filter(i => i.priority === level).length;
  }
  return { total: queue.length, byPriority, humanApprovalRequired: true };
}

function buildPacket(input = {}) {
  const initialItems = input.items || [];
  let queue = [];
  for (const item of initialItems) {
    const result = enqueue(queue, item);
    if (result.ok) queue = result.queue;
  }
  const status = getQueueStatus(queue);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    queuePolicy: QUEUE_POLICY,
    queue,
    status
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    items: [
      { provider: 'claude', taskType: 'bugfix', priority: 'high', dataLevel: 'A' },
      { provider: 'gemini', taskType: 'draft', priority: 'normal', dataLevel: 'A' }
    ]
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  QUEUE_POLICY,
  createQueueItem,
  enqueue,
  dequeue,
  getQueueStatus,
  buildPacket
};
