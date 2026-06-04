'use strict';

const TOOL_META = {
  version:       '47.0.0',
  schemaVersion: '1.0.0',
  title:         'KOSAME Dev Orchestra Visual Status JSON Export Pack',
  slug:          'dev-agent-visual-status-json-export-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'discord webhook send',
  'external http request'
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
  { name: 'Secret read',        status: 'BLOCKED', action: 'deny' },
  { name: '.env read',          status: 'BLOCKED', action: 'deny' },
  { name: 'deploy',             status: 'BLOCKED', action: 'deny' },
  { name: 'git push by AI',     status: 'BLOCKED', action: 'deny' },
  { name: 'customer data read', status: 'BLOCKED', action: 'deny' },
  { name: 'destructive delete', status: 'BLOCKED', action: 'deny' }
];

function buildVisualStatusJSON(opts) {
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

  return {
    schemaVersion:          TOOL_META.schemaVersion,
    orchestraVersion:       TOOL_META.version,
    product:                opts.product   || 'ANESTY Board',
    task:                   opts.task      || '-',
    repo:                   opts.repo      || '/home/shimohigoshi/anesty-board',
    commit:                 opts.commit    || '-',
    stages,
    agents,
    dangerGates,
    acceptance,
    nextAction:             opts.nextAction || 'Claude Codeへcontrolled taskを貼る → 完了報告をこさめへ戻す',
    generatedAt:            new Date(now).toISOString(),
    dryRun:                 true,
    humanApprovalRequired:  true,
    dangerousActionsDenied: opts.dangerousActionsDenied || DANGEROUS_ACTIONS_DENIED,
    discordWebhookSent:     false,
    externalRequestSent:    false
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_STAGES,
  DEFAULT_AGENTS,
  DEFAULT_DANGER_GATES,
  buildVisualStatusJSON
};

if (require.main === module) {
  const json = buildVisualStatusJSON({
    product: 'ANESTY Board',
    task:    'v87.0.9 docs/runbook controlled task',
    repo:    '/home/shimohigoshi/anesty-board',
    commit:  '302f692'
  });
  console.log(JSON.stringify(json, null, 2));
}
