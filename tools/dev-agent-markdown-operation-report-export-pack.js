'use strict';

const fs   = require('fs');
const path = require('path');

const TOOL_META = {
  version: '46.0.0',
  title:   'KOSAME Dev Orchestra Markdown Operation Report Export Pack',
  slug:    'dev-agent-markdown-operation-report-export-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const REPORTS_DIR = path.join(__dirname, '../reports/orchestra');

function buildMarkdownReport(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const ts  = new Date(now);

  const target      = opts.target      || {};
  const stages      = opts.stages      || [];
  const agents      = opts.agents      || [];
  const dangerGates = opts.dangerGates || [];
  const acceptance  = opts.acceptance  || {};
  const blockers    = acceptance.blockers || [];

  const lines = [];
  lines.push(`# ${opts.title || 'KOSAME Dev Orchestra Operation Report'}`);
  lines.push('');
  lines.push(`**Generated**: ${ts.toISOString()}`);
  lines.push(`**Orchestra Version**: ${TOOL_META.version}`);
  lines.push(`**dryRun**: true`);
  lines.push('');

  lines.push('## Target');
  lines.push(`- **Product**: ${target.product || '-'}`);
  lines.push(`- **Task**: ${target.task || '-'}`);
  lines.push(`- **Repo**: ${target.repo || '-'}`);
  lines.push(`- **Commit**: ${target.commit || '-'}`);
  lines.push('');

  lines.push('## Responsible AI');
  for (const a of agents) {
    lines.push(`- **${a.name}**: ${a.status}`);
  }
  lines.push('');

  lines.push('## Stage Summary');
  lines.push('| Stage | Status |');
  lines.push('|-------|--------|');
  for (const s of stages) {
    lines.push(`| ${s.name} | ${s.status} |`);
  }
  lines.push('');

  lines.push('## Danger Gates');
  for (const g of dangerGates) {
    lines.push(`- **${g.name}**: ${g.status}`);
  }
  lines.push('');

  lines.push('## Verify Result');
  if (opts.verifyResult) {
    lines.push(opts.verifyResult);
  } else {
    lines.push('- npm run verify: TBD');
  }
  lines.push('');

  lines.push('## Acceptance');
  lines.push(`- **Commit Candidate**: ${acceptance.commitCandidate ? 'YES' : 'NO'}`);
  lines.push(`- **Human Approval Required**: ${acceptance.humanApprovalRequired !== false ? 'YES' : 'NO'}`);
  lines.push(`- **Blockers**: ${blockers.length ? blockers.join(', ') : 'none'}`);
  lines.push('');

  lines.push('## Next Action');
  const na = opts.nextAction;
  if (Array.isArray(na)) {
    for (const n of na) lines.push(`- ${n}`);
  } else {
    lines.push(na || '-');
  }
  lines.push('');

  lines.push('## Handoff Note');
  lines.push(opts.handoffNote || 'こさめ/GPTがAcceptance Gateを実施。じゅんやさんが最終YES担当。');
  lines.push('');

  lines.push('## Dangerous Actions Denied');
  for (const d of (opts.dangerousActionsDenied || DANGEROUS_ACTIONS_DENIED)) {
    lines.push(`- ${d}`);
  }
  lines.push('');

  return lines.join('\n');
}

function exportReport(opts) {
  opts = opts || {};
  const dryRun = opts.dryRun !== false;
  const now     = opts.timestamp || Date.now();
  const ts      = new Date(now);
  const dateStr = ts.toISOString().slice(0, 10).replace(/-/g, '');
  const slug    = (opts.taskSlug || 'report').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const filename = `${dateStr}_${slug}_report.md`;

  const markdown = buildMarkdownReport(opts);

  const result = {
    version:               TOOL_META.version,
    dryRun,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    markdownContent:       markdown,
    filename
  };

  if (!dryRun) {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
    const filePath = path.join(REPORTS_DIR, filename);
    fs.writeFileSync(filePath, markdown, 'utf8');
    result.writtenTo = filePath;
  } else {
    result.writtenTo = null;
    result.dryRunNote = `dryRun=true: file not written. Would write to ${path.join(REPORTS_DIR, filename)}`;
  }

  return result;
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  REPORTS_DIR,
  buildMarkdownReport,
  exportReport
};

if (require.main === module) {
  const result = exportReport({
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
    acceptance: {
      commitCandidate:       false,
      humanApprovalRequired: true,
      blockers:              []
    },
    nextAction: 'こさめ/GPTがレビュー → じゅんやさん最終YES'
  });
  console.log('dryRunNote:', result.dryRunNote);
  console.log('\nMarkdown output:\n', result.markdownContent);
}
