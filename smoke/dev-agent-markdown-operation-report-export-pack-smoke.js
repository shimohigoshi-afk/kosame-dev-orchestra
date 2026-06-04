'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-markdown-operation-report-export-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-markdown-operation-report-export-pack smoke ===');

// package version >= 46
assert.ok(
  parseInt(pkg.version.split('.')[0], 10) >= 46,
  `pkg version must be >= 46.0.0, got ${pkg.version}`
);
console.log('  PASS: package version 46.0.0 or later');

// smoke script exists
assert.ok(pkg.scripts['smoke:markdown-operation-report-export'], 'smoke:markdown-operation-report-export script must exist');
console.log('  PASS: smoke script exists');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-markdown-operation-report-export-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta version
assert.strictEqual(tool.TOOL_META.version, '46.0.0', 'tool version must be 46.0.0');
console.log('  PASS: tool meta version 46.0.0');

const opts = {
  dryRun:   true,
  title:    'v46.0.0 Markdown Operation Report',
  taskSlug: 'v46-markdown-operation-report',
  target: {
    product: 'ANESTY Board',
    task:    'v46.0.0 Markdown Operation Report Export',
    repo:    '/home/shimohigoshi/anesty-board',
    commit:  '302f692'
  },
  stages: [
    { name: 'Intake',                status: 'DONE'    },
    { name: 'Work Order',            status: 'DONE'    },
    { name: 'Safety Gate',           status: 'DONE'    },
    { name: 'Claude Prompt',         status: 'READY'   },
    { name: 'Claude Implementation', status: 'WAITING' },
    { name: 'Verify',                status: 'WAITING' },
    { name: 'Acceptance Gate',       status: 'WAITING' },
    { name: 'Human Approval',        status: 'WAITING' }
  ],
  agents: [
    { name: 'KOSAME / GPT',   status: 'PM_READY'        },
    { name: 'Claude / Kuro',  status: 'WAITING'         },
    { name: 'Gemini',         status: 'STANDBY'         },
    { name: 'GitHub Actions', status: 'WAITING'         },
    { name: 'Human / Junya',  status: 'APPROVAL_PENDING' }
  ],
  dangerGates: [
    { name: 'Secret read',        status: 'BLOCKED' },
    { name: '.env read',          status: 'BLOCKED' },
    { name: 'deploy',             status: 'BLOCKED' },
    { name: 'git push by AI',     status: 'BLOCKED' },
    { name: 'customer data read', status: 'BLOCKED' },
    { name: 'destructive delete', status: 'BLOCKED' }
  ],
  verifyResult: '- npm run verify: PASS (all smokes green)',
  acceptance: {
    commitCandidate:       false,
    humanApprovalRequired: true,
    blockers:              []
  },
  nextAction: 'こさめ/GPTがレビュー → じゅんやさん最終YES'
};

const result = tool.exportReport(opts);

// dryRun true
assert.strictEqual(result.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

// humanApprovalRequired true
assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// writtenTo null in dryRun
assert.strictEqual(result.writtenTo, null, 'writtenTo must be null in dryRun');
console.log('  PASS: reports/orchestra 以外に書き込まない (dryRun=true, writtenTo=null)');

// dryRunNote contains reports/orchestra path
assert.ok(result.dryRunNote && result.dryRunNote.includes('reports/orchestra'), 'dryRunNote must mention reports/orchestra path');
console.log('  PASS: dryRunNote references reports/orchestra');

// markdown content checks
const md = result.markdownContent;
assert.ok(typeof md === 'string' && md.length > 100, 'markdownContent must be a non-trivial string');
assert.ok(md.includes('# '),             'markdown must contain a title (# heading)');
assert.ok(md.includes('## Target'),      'markdown must contain ## Target');
assert.ok(md.includes('## Stage Summary'), 'markdown must contain ## Stage Summary');
assert.ok(md.includes('## Responsible AI'), 'markdown must contain ## Responsible AI (agents)');
assert.ok(md.includes('## Danger Gates'), 'markdown must contain ## Danger Gates');
assert.ok(md.includes('## Verify Result'), 'markdown must contain ## Verify Result');
assert.ok(md.includes('## Acceptance'), 'markdown must contain ## Acceptance');
assert.ok(md.includes('## Next Action'), 'markdown must contain ## Next Action');
assert.ok(md.includes('## Handoff Note'), 'markdown must contain ## Handoff Note');
console.log('  PASS: markdown contains title/product/repo/stages/agents/danger gates/verify/acceptance/next action');

// humanApprovalRequired appears in content
assert.ok(md.includes('Human Approval Required'), 'markdown must mention Human Approval Required');
console.log('  PASS: humanApprovalRequired in markdown content');

// dangerousActionsDenied correct
const denied = result.dangerousActionsDenied;
assert.ok(Array.isArray(denied) && denied.length >= 4, 'dangerousActionsDenied must have 4+ items');
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
console.log('  PASS: dangerousActionsDenied correct');

// buildMarkdownReport export
const mdOnly = tool.buildMarkdownReport(opts);
assert.ok(typeof mdOnly === 'string' && mdOnly.length > 50, 'buildMarkdownReport must return a string');
console.log('  PASS: buildMarkdownReport exported and callable');

// REPORTS_DIR export and path check
assert.ok(typeof tool.REPORTS_DIR === 'string', 'REPORTS_DIR must be exported');
assert.ok(tool.REPORTS_DIR.includes('reports/orchestra'), 'REPORTS_DIR must point to reports/orchestra');
console.log('  PASS: REPORTS_DIR exported and correct');

console.log('=== dev-agent-markdown-operation-report-export-pack smoke PASSED ===');
