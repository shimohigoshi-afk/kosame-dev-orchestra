/**
 * Deny Command Guard v3.4.0
 *
 * Detects and rejects forbidden/dangerous commands.
 * Always checked before any command is proposed to Cloud Shell.
 */

const DENY_PATTERNS = [
  { pattern: /rm\s+-rf/i,           label: 'rm -rf',                  severity: 'CRITICAL' },
  { pattern: /git\s+reset\s+--hard/i, label: 'git reset --hard',       severity: 'CRITICAL' },
  { pattern: /git\s+clean\s+-f/i,   label: 'git clean -f',             severity: 'CRITICAL' },
  { pattern: /git\s+clean\s+-fd/i,  label: 'git clean -fd',            severity: 'CRITICAL' },
  { pattern: /gcloud\s+run\s+deploy/i, label: 'gcloud run deploy',     severity: 'CRITICAL' },
  { pattern: /gcloud\s+deploy/i,    label: 'gcloud deploy',             severity: 'CRITICAL' },
  { pattern: /docker\s+build/i,     label: 'docker build',              severity: 'HIGH' },
  { pattern: /docker\s+push/i,      label: 'docker push',               severity: 'HIGH' },
  { pattern: /\.env/i,              label: 'Secret/.env access',        severity: 'CRITICAL' },
  { pattern: /cat\s+.*\.env/i,      label: '.env file read',            severity: 'CRITICAL' },
  { pattern: /GOOGLE_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY/i, label: 'API key exposure', severity: 'CRITICAL' },
  { pattern: /gcloud\s+secrets/i,   label: 'Secret Manager access',     severity: 'CRITICAL' },
  { pattern: /git\s+push\s+--force/i, label: 'git push --force',       severity: 'CRITICAL' },
  { pattern: /git\s+push\s+origin\s+main\b/i, label: 'git push origin main (unauthorized)', severity: 'HIGH' },
  { pattern: /git\s+tag\s+v\d/i,    label: 'git tag (must have approval)', severity: 'HIGH' },
  { pattern: /npm\s+publish/i,      label: 'npm publish',               severity: 'HIGH' },
  { pattern: /curl.*https?:\/\/[^l]/i, label: 'external HTTP call',    severity: 'HIGH' },
  { pattern: /fetch\s*\(/i,         label: 'external fetch call',        severity: 'HIGH' }
];

const ALWAYS_ALLOWED = [
  /^node\s+--check/,
  /^npm\s+run\s+(verify|smoke:|kosame:|pm-agent:)/,
  /^git\s+status/,
  /^git\s+log/,
  /^git\s+diff/,
  /^git\s+add\s+(?!-A|--all)[\w./]/,
  /^git\s+commit\s+-m/,
  /^ls\s/,
  /^cat\s+(?!.*\.env)/
];

function guardCommand(command = '') {
  const trimmed = command.trim();

  const isAlwaysAllowed = ALWAYS_ALLOWED.some(p => p.test(trimmed));
  if (isAlwaysAllowed) {
    return { allowed: true, command: trimmed, matches: [], note: 'Explicitly allowed command.' };
  }

  const matches = DENY_PATTERNS.filter(({ pattern }) => pattern.test(trimmed));
  const allowed = matches.length === 0;
  const severity = matches.length > 0
    ? matches.some(m => m.severity === 'CRITICAL') ? 'CRITICAL' : 'HIGH'
    : null;

  return {
    allowed,
    command: trimmed,
    matches: matches.map(m => ({ label: m.label, severity: m.severity })),
    severity,
    denyReason: allowed ? null : `Denied: ${matches.map(m => m.label).join(', ')}`,
    note: allowed ? 'No deny patterns matched.' : 'Command contains forbidden pattern(s).'
  };
}

function guardCommandList(commands = []) {
  const results = commands.map(c => ({ ...guardCommand(c), originalCommand: c }));
  const deniedCommands = results.filter(r => !r.allowed);
  const allAllowed = deniedCommands.length === 0;

  return {
    guard: 'deny-command-guard',
    allAllowed,
    results,
    deniedCommands,
    deniedCount: deniedCommands.length,
    allowedCount: results.length - deniedCommands.length,
    version: '3.4.0',
    checkedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { guardCommand, guardCommandList, DENY_PATTERNS };

if (require.main === module) {
  const result = guardCommandList([
    'npm run verify',
    'git status -sb',
    'rm -rf node_modules',
    'git reset --hard HEAD',
    'git add tools/foo.js',
    'git tag v3.4.0'
  ]);
  console.log(JSON.stringify(result, null, 2));
}
