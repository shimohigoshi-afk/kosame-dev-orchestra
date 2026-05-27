'use strict';

const TOOL_META = {
  version: '6.2.0',
  title: 'Project Template Applicator',
  slug: 'project-template-applicator-pack'
};

const STANDARD_DIRECTORIES = ['docs/ai-dev-team', 'tools', 'smoke', 'fixtures'];

const STANDARD_SCRIPTS = {
  verify: 'npm run smoke:all',
  'smoke:all': 'echo "configure individual smoke scripts"'
};

const APPROVAL_GATE_TEMPLATE = {
  commitGate: { requiresHumanApproval: true, approver: 'じゅんやさん', trigger: 'git commit' },
  pushGate:   { requiresHumanApproval: true, approver: 'じゅんやさん', trigger: 'git push' },
  tagGate:    { requiresHumanApproval: true, approver: 'じゅんやさん', trigger: 'git tag' },
  deployGate: { requiresHumanApproval: true, approver: 'じゅんやさん', trigger: 'deploy' }
};

const STANDARD_DOCS = [
  'docs/ai-dev-team/{project}-release-record.md',
  'docs/ai-dev-team/{project}-operation-standard.md'
];

const STANDARD_FILES = [
  'tools/{project}-pack.js',
  'smoke/dev-agent-{project}-pack-smoke.js',
  'fixtures/{project}.sample.json'
];

function generateDirectoryPlan(projectName = 'new-project') {
  return STANDARD_DIRECTORIES.map(dir => ({
    path: dir,
    action: 'ensure_exists',
    projectName
  }));
}

function generateFilePlan(projectName = 'new-project', version = '1.0.0') {
  const slug = projectName.toLowerCase().replace(/\s+/g, '-');
  const files = [
    ...STANDARD_DOCS.map(f => f.replace('{project}', slug)),
    ...STANDARD_FILES.map(f => f.replace('{project}', slug))
  ];
  return files.map(path => ({ path, action: 'create', version, slug }));
}

function applyTemplate(input = {}) {
  const projectName = input.projectName || 'new-project';
  const version = input.version || '1.0.0';
  const productLine = input.productLine || 'backoffice';

  return {
    projectName,
    version,
    productLine,
    directories: generateDirectoryPlan(projectName),
    files: generateFilePlan(projectName, version),
    approvalGates: APPROVAL_GATE_TEMPLATE,
    standardScripts: STANDARD_SCRIPTS,
    humanApprovalRequired: true
  };
}

function buildPacket(input = {}) {
  const template = applyTemplate(input);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    standardDirectories: STANDARD_DIRECTORIES,
    standardDocs: STANDARD_DOCS,
    standardFiles: STANDARD_FILES,
    approvalGateTemplate: APPROVAL_GATE_TEMPLATE,
    template
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    projectName: process.env.KOSAME_PROJECT_NAME || 'sample-project',
    version: process.env.KOSAME_VERSION || '1.0.0',
    productLine: process.env.KOSAME_PRODUCT_LINE || 'backoffice'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  STANDARD_DIRECTORIES,
  STANDARD_SCRIPTS,
  APPROVAL_GATE_TEMPLATE,
  STANDARD_DOCS,
  STANDARD_FILES,
  generateDirectoryPlan,
  generateFilePlan,
  applyTemplate,
  buildPacket
};
