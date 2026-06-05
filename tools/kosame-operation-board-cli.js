#!/usr/bin/env node
'use strict';

/**
 * KOSAME Dev Orchestra v110.5
 * Operation Board executable CLI.
 *
 * Purpose:
 * - Make the v110.4 CLI Agent Status Board usable from Cloud Shell.
 * - Keep this command dry-run and display-only by default.
 * - Do not execute commit/push/tag/deploy/secret/billing/customer operations.
 */

const DEFAULTS = {
  target: 'ANESTY Board v87.0.11',
  stage: 'implementing',
  gate: 'none',
  budgetUsed: '0.00',
  budgetLimit: '10.00',
  next: 'smoke → verify → commit candidate',
  burden: 'LOW',
};

const AGENTS = [
  ['Claude Code', 'implementing'],
  ['Gemini', 'preprocessing_standby'],
  ['GPT', 'execution_assistant_only'],
  ['Grok', 'breakthrough_standby'],
  ['DeepSeek', 'HOLD sanitized_only'],
  ['Kimi', 'HOLD sanitized_only'],
  ['Human', 'approval_owner'],
];

const HUMAN_APPROVAL_GATES = new Set([
  'commit_wait',
  'push_wait',
  'tag_wait',
  'deploy_blocked',
  'secret_blocked',
  'budget_gate',
  'customer_data_gate',
  'billing_gate',
  'contract_gate',
  'blocked',
]);

function parseArgs(argv) {
  const out = { ...DEFAULTS };

  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;

    const eq = raw.indexOf('=');
    const key = eq >= 0 ? raw.slice(2, eq) : raw.slice(2);
    const value = eq >= 0 ? raw.slice(eq + 1) : 'true';

    switch (key) {
      case 'target':
        out.target = value;
        break;
      case 'stage':
        out.stage = value;
        break;
      case 'gate':
        out.gate = value;
        break;
      case 'budget-used':
      case 'budgetUsed':
        out.budgetUsed = value;
        break;
      case 'budget-limit':
      case 'budgetLimit':
        out.budgetLimit = value;
        break;
      case 'next':
        out.next = value;
        break;
      case 'burden':
        out.burden = value;
        break;
      case 'help':
        out.help = true;
        break;
      default:
        out[key] = value;
    }
  }

  return out;
}

function approvalLabel(gate) {
  return HUMAN_APPROVAL_GATES.has(String(gate || '').trim())
    ? 'human_approval_required'
    : 'auto_proceed';
}

function renderBoard(options) {
  const approval = approvalLabel(options.gate);

  const lines = [];
  lines.push('===== KOSAME Operation Board =====');
  lines.push(`TARGET  : ${options.target}`);
  lines.push(`STAGE   : ${options.stage}`);
  lines.push('AGENTS  :');

  for (const [name, status] of AGENTS) {
    lines.push(`${name.padEnd(12, ' ')}: ${status}`);
  }

  lines.push(`GATE    : ${options.gate} (${approval})`);
  lines.push(`BUDGET  : $${options.budgetUsed} / $${options.budgetLimit}`);
  lines.push(`NEXT    : ${options.next}`);
  lines.push(`BURDEN  : ${options.burden}`);
  lines.push('DRY RUN : true');
  lines.push('REAL PRODUCT ACTIONS EXECUTED : false');
  lines.push('DANGEROUS ACTIONS DENIED      : true');
  lines.push('==================================');

  return lines.join('\n');
}

function printHelp() {
  console.log(`KOSAME Operation Board CLI

Usage:
  npm run opboard
  npm run kosame:board
  node tools/kosame-operation-board-cli.js --target="ANESTY Board v87.0.11" --stage=implementing

Options:
  --target="..."
  --stage=implementing|verify|gate_wait|done
  --gate=none|commit_wait|push_wait|tag_wait|deploy_blocked|secret_blocked|budget_gate|blocked
  --budget-used=0.00
  --budget-limit=10.00
  --next="smoke → verify → commit candidate"
  --burden=LOW|WATCH|HIGH|TOO_MUCH
`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  console.log(renderBoard(options));
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULTS,
  AGENTS,
  HUMAN_APPROVAL_GATES,
  parseArgs,
  approvalLabel,
  renderBoard,
};
