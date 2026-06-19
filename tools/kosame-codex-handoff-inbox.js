#!/usr/bin/env node
'use strict';

const path = require('node:path');

const {
  getLatestPath,
  getQueuePath,
  readLatestHandoffInbox,
  readHandoffQueue,
  sanitizeHandoffPayload,
} = require('./kosame-codex-handoff-bridge-server');

const ROOT = path.resolve(__dirname, '..');

function printRecord(record) {
  const safe = sanitizeHandoffPayload(record);
  const lines = [
    `id: ${safe.id}`,
    `title: ${safe.title}`,
    `target_repo: ${safe.target_repo}`,
    `assigned_agent: ${safe.assigned_agent}`,
    `risk_level: ${safe.risk_level}`,
    `human_gate_required: ${safe.human_gate_required ? 'true' : 'false'}`,
    `created_at: ${safe.created_at}`,
    `source: ${safe.source}`,
    '',
    'prompt_text:',
    safe.prompt_text,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function run() {
  const mode = String(process.argv[2] || 'latest').trim();
  try {
    if (mode === 'list') {
      const queue = readHandoffQueue({});
      process.stdout.write(`handoffDir: ${queue.handoffDir || path.join(ROOT, '.kosame-handoff')}\n`);
      process.stdout.write(`queuePath: ${getQueuePath({ handoffDir: queue.handoffDir })}\n`);
      process.stdout.write(`latestPath: ${getLatestPath({ handoffDir: queue.handoffDir })}\n`);
      process.stdout.write(`count: ${queue.count}\n\n`);
      queue.items.forEach((item, index) => {
        process.stdout.write(`[${index + 1}] ${item.id} / ${item.title} / ${item.assigned_agent} / ${item.target_repo}\n`);
      });
      return;
    }

    const latest = readLatestHandoffInbox({});
    process.stdout.write(`handoffDir: ${latest.handoffDir || path.join(ROOT, '.kosame-handoff')}\n`);
    process.stdout.write(`latestPath: ${latest.latestPath}\n`);
    process.stdout.write(`queuePath: ${latest.queuePath}\n`);
    process.stdout.write(`count: ${latest.count}\n\n`);
    if (!latest.latest) {
      process.stdout.write('latest: (empty)\n');
      return;
    }
    printRecord(latest.latest);
  } catch (error) {
    process.stderr.write(`${error && error.message ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

run();
