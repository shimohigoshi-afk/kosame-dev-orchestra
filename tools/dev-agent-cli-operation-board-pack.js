'use strict';

const TOOL_META = {
  version: '45.0.0',
  title:   'KOSAME Dev Orchestra CLI Operation Board Pack',
  slug:    'dev-agent-cli-operation-board-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const DEFAULT_STAGES = [
  { name: 'Intake',                status: 'DONE'    },
  { name: 'Work Order',            status: 'DONE'    },
  { name: 'Safety Gate',           status: 'DONE'    },
  { name: 'Claude Prompt',         status: 'READY'   },
  { name: 'Claude Implementation', status: 'WAITING' },
  { name: 'Verify',                status: 'WAITING' },
  { name: 'Acceptance Gate',       status: 'WAITING' },
  { name: 'Human Approval',        status: 'WAITING' }
];

const DEFAULT_AGENTS = [
  { name: 'KOSAME / GPT',   status: 'PM_READY'        },
  { name: 'Claude / Kuro',  status: 'WAITING'         },
  { name: 'Gemini',         status: 'STANDBY'         },
  { name: 'Grok',           status: 'STANDBY'         },
  { name: 'GitHub Actions', status: 'WAITING'         },
  { name: 'Cloud Shell',    status: 'READY'           },
  { name: 'Human / Junya',  status: 'APPROVAL_PENDING' }
];

const DEFAULT_DANGER_GATES = [
  { name: 'Secret read',        status: 'BLOCKED' },
  { name: '.env read',          status: 'BLOCKED' },
  { name: 'deploy',             status: 'BLOCKED' },
  { name: 'git push by AI',     status: 'BLOCKED' },
  { name: 'customer data read', status: 'BLOCKED' },
  { name: 'destructive delete', status: 'BLOCKED' }
];

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m'
};

function colorStatus(status) {
  switch (status) {
    case 'DONE':
    case 'PASS':
    case 'READY':     return C.green  + status + C.reset;
    case 'BLOCKED':   return C.red    + status + C.reset;
    case 'WAITING':
    case 'STANDBY':   return C.yellow + status + C.reset;
    case 'PM_READY':
    case 'APPROVAL_PENDING': return C.cyan + status + C.reset;
    default:          return status;
  }
}

function renderBoard(packet) {
  const t  = packet.target || {};
  const lines = [];

  lines.push(C.bold + '='.repeat(56) + C.reset);
  lines.push(C.bold + ' KOSAME Dev Orchestra Operation Board' + C.reset);
  lines.push(C.bold + '='.repeat(56) + C.reset);
  lines.push('');

  lines.push(C.bold + 'TARGET' + C.reset);
  lines.push('  Product          : ' + (t.product || '-'));
  lines.push('  Task             : ' + (t.task    || '-'));
  lines.push('  Repo             : ' + (t.repo    || '-'));
  lines.push('  Orchestra Version: ' + (t.version || TOOL_META.version));
  lines.push('  Commit           : ' + (t.commit  || '-'));
  lines.push('');

  lines.push(C.bold + 'STAGE' + C.reset);
  for (const s of (packet.stages || DEFAULT_STAGES)) {
    lines.push('  ' + s.name.padEnd(26) + colorStatus(s.status));
  }
  lines.push('');

  lines.push(C.bold + 'AGENTS' + C.reset);
  for (const a of (packet.agents || DEFAULT_AGENTS)) {
    lines.push('  ' + a.name.padEnd(20) + colorStatus(a.status));
  }
  lines.push('');

  lines.push(C.bold + 'DANGER GATES' + C.reset);
  for (const g of (packet.dangerGates || DEFAULT_DANGER_GATES)) {
    lines.push('  ' + g.name.padEnd(26) + colorStatus(g.status));
  }
  lines.push('');

  lines.push(C.bold + 'NEXT ACTION' + C.reset);
  const na = packet.nextAction;
  if (Array.isArray(na)) {
    for (const n of na) lines.push('  - ' + n);
  } else {
    lines.push('  ' + (na || '-'));
  }
  lines.push('');

  const acc = packet.acceptance || {};
  lines.push(C.bold + 'ACCEPTANCE' + C.reset);
  lines.push('  commit candidate     : ' + (acc.commitCandidate     ? 'YES' : 'NO'));
  lines.push('  human approval req   : ' + (acc.humanApprovalRequired !== false ? 'YES' : 'NO'));
  const blockers = acc.blockers || [];
  lines.push('  blockers             : ' + (blockers.length ? blockers.join(', ') : 'none'));
  lines.push('');

  lines.push(C.bold + '='.repeat(56) + C.reset);

  return lines.join('\n');
}

function buildOperationBoard(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();

  const stages     = opts.stages     || JSON.parse(JSON.stringify(DEFAULT_STAGES));
  const agents     = opts.agents     || JSON.parse(JSON.stringify(DEFAULT_AGENTS));
  const dangerGates = opts.dangerGates || JSON.parse(JSON.stringify(DEFAULT_DANGER_GATES));

  const blockers = opts.blockers || [];
  const commitCandidate = opts.commitCandidate !== undefined
    ? opts.commitCandidate
    : (blockers.length === 0);

  const acceptance = opts.acceptance || {
    commitCandidate,
    humanApprovalRequired: true,
    blockers
  };

  const packet = {
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    target: {
      product: opts.product || 'ANESTY Board',
      task:    opts.task    || '-',
      repo:    opts.repo    || '/home/shimohigoshi/anesty-board',
      version: opts.version || TOOL_META.version,
      commit:  opts.commit  || '-'
    },
    stages,
    agents,
    dangerGates,
    acceptance,
    nextAction: opts.nextAction || 'Claude Codeへcontrolled taskを貼る → 完了報告をこさめへ戻す',
    generatedAt: new Date(now).toISOString()
  };

  packet.boardText = renderBoard(packet);
  return packet;
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_STAGES,
  DEFAULT_AGENTS,
  DEFAULT_DANGER_GATES,
  renderBoard,
  buildOperationBoard
};

if (require.main === module) {
  const packet = buildOperationBoard({
    product: 'ANESTY Board',
    task:    'v87.0.9 docs/runbook controlled task',
    repo:    '/home/shimohigoshi/anesty-board',
    version: '45.0.0',
    commit:  '302f692'
  });
  console.log(packet.boardText);
}
