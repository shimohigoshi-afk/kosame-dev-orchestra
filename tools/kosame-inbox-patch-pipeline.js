#!/usr/bin/env node
'use strict';

/**
 * KOSAME Dev Orchestra v110.17
 * Inbox → Route → Patch Candidate → Verify → Commit Candidate Pipeline
 *
 * Connects Command Inbox and Agent Patch Executor into a single flow:
 *   1 line input → routing plan → Gemini dispatch → patch extraction
 *   → verify check → commit candidate (no actual commit)
 *
 * Usage:
 *   node tools/kosame-inbox-patch-pipeline.js --input="<task>" [--yes] [--live] [--output=<file>]
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { buildInboxPlan } = require('./kosame-command-inbox');
const { arbitrate } = require('./gpt-task-arbiter');
const { enrichContext, detectInsufficientContext } = require('./multi-agent-task-router');
const { extractPatches } = require('./kosame-patch-executor');
const geminiProvider = require('../providers/gemini-provider');

const TOOL_META = {
  version: '110.17.0',
  slug: 'kosame-inbox-patch-pipeline',
  feature: 'v110-17-inbox-patch-pipeline',
};

function parseArgs(args) {
  const get = prefix => args.find(a => a.startsWith(prefix))?.slice(prefix.length) ?? null;
  return {
    input: get('--input='),
    yes: args.includes('--yes'),
    live: args.includes('--live'),
    output: get('--output='),
  };
}

function buildCommitCandidate(patches, input) {
  if (!patches || patches.length === 0) return null;
  const files = patches.map(p => p.file);
  const scope = files.length === 1 ? path.basename(files[0], path.extname(files[0])) : `${files.length}-files`;
  const shortInput = input.length > 60 ? input.slice(0, 60) + '…' : input;
  const suggestedMessage = `feat(v110.17/${scope}): ${shortInput}`;
  return {
    suggestedMessage,
    files,
    scope,
    requiresExplicitYes: true,
    actualCommitNotExecuted: true,
    gitCommand: `git add ${files.map(f => `"${f}"`).join(' ')} && git commit -m "${suggestedMessage}"`,
  };
}

async function dispatchGemini(tasks, live, originalInput) {
  const results = [];
  for (const task of tasks) {
    const enrichedInput = enrichContext(task, originalInput);
    const packet = { id: `pipeline-gemini-${Date.now()}`, type: 'generate', input: enrichedInput };
    const result = await geminiProvider.run(packet, { live });
    const insufficient = detectInsufficientContext(result.response);
    results.push({ task, result, insufficient });
  }
  return results;
}

async function run(argv) {
  const { input, yes, live, output } = parseArgs(argv.slice(2));
  const dryRun = !yes;

  if (!input) {
    console.error('ERROR: --input="<task>" is required');
    process.exit(1);
  }

  console.log(`\n===== KOSAME Inbox Patch Pipeline v${TOOL_META.version} =====`);
  console.log(`INPUT   : ${input.length > 100 ? input.slice(0, 100) + '…' : input}`);
  console.log(`DRY RUN : ${dryRun}`);
  console.log(`LIVE    : ${live}`);
  console.log('=======================================================\n');

  // Step 1: Command Inbox → build plan
  console.log('[1/5] Command Inbox → parsing input…');
  const inboxPlan = buildInboxPlan({ input });
  console.log(`  REPO      : ${inboxPlan.repo.id}`);
  console.log(`  WORK TYPE : ${inboxPlan.workType}`);
  console.log(`  PROVIDERS : ${inboxPlan.providers.map(p => p.provider).join(', ')}`);

  // Step 2: Task Router → arbitrate routing
  console.log('\n[2/5] Task Router → arbitrating…');
  const routing = await arbitrate(input, { live });
  console.log(`  Method : ${routing.method}`);
  console.log(`  Gemini : ${routing.gemini.length} task(s)`);
  console.log(`  Claude : ${routing.claudeCode.length} task(s)`);
  console.log(`  Grok   : ${routing.grok.length} task(s)`);
  if (routing.reasoning) console.log(`  Reason : ${routing.reasoning}`);

  if (dryRun) {
    console.log('\n──────────────────────────────────────────────');
    console.log('DRY RUN: Showing pipeline plan (pass --yes to execute)');
    console.log('──────────────────────────────────────────────');
    console.log('\n[Routing Plan]');
    routing.gemini.forEach((t, i) => console.log(`  Gemini[${i + 1}]: ${t.slice(0, 80)}`));
    routing.claudeCode.forEach((t, i) => console.log(`  Claude[${i + 1}]: ${t.slice(0, 80)}`));
    routing.grok.forEach((t, i) => console.log(`  Grok[${i + 1}]: ${t.slice(0, 80)}`));
    console.log('\n[Step 3] Gemini dispatch → patch extraction  (skipped)');
    console.log('[Step 4] Verify                               (skipped)');
    console.log('[Step 5] Commit candidate                     (skipped)');

    const plan = {
      toolMeta: TOOL_META,
      dryRun: true,
      input,
      inboxPlan,
      routing,
      patchStep: 'skipped (dry-run)',
      verifyStep: 'skipped (dry-run)',
      commitCandidate: null,
      safety: {
        realProductActionsExecuted: false,
        dangerousActionsDenied: true,
        commitTagPushRequiresYes: true,
        actualCommitNotExecuted: true,
      },
    };

    if (output) {
      fs.writeFileSync(output, JSON.stringify(plan, null, 2));
      console.log(`\n💾 Dry-run plan saved to ${output}`);
    }

    return plan;
  }

  // Step 3: Gemini dispatch + patch extraction
  console.log('\n[3/5] Gemini dispatch → extracting patch candidates…');
  const allPatches = [];
  const geminiResults = routing.gemini.length > 0
    ? await dispatchGemini(routing.gemini, live, input)
    : [];

  for (const { task, result, insufficient } of geminiResults) {
    const status = insufficient ? '[WARN:INSUFFICIENT_CONTEXT]' : result.success === false ? '[FAIL]' : '[OK]';
    console.log(`  ${status} ${task.slice(0, 60)}`);
    if (insufficient) {
      console.log('       ⚠️ INSUFFICIENT_CONTEXT — patch extraction skipped for this task');
      continue;
    }
    if (result.response) {
      const patches = extractPatches(result.response);
      console.log(`       → ${patches.length} patch(es) extracted`);
      allPatches.push(...patches);
    }
  }

  // Step 4: Verify (only if patches found)
  console.log(`\n[4/5] Patch summary → ${allPatches.length} patch(es) found`);
  let verifyPassed = false;
  let verifySkipped = false;

  if (allPatches.length === 0) {
    console.log('  No patches to apply — verify skipped.');
    verifySkipped = true;
  } else {
    console.log('  Patches ready (not applied — use kosame-patch-executor --yes to write files)');
    allPatches.forEach(p => console.log(`    - ${p.file} (${p.content.length} bytes)`));
    console.log('\n  Running quick smoke verification (npm run smoke:v110-13-multi-agent-task-router)…');
    try {
      execSync('npm run smoke:v110-13-multi-agent-task-router', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..'),
      });
      verifyPassed = true;
      console.log('  ✅ Verify PASSED');
    } catch {
      console.warn('  ⚠️ Verify check failed — commit candidate still generated for review');
      verifyPassed = false;
    }
  }

  // Step 5: Commit candidate
  console.log('\n[5/5] Building commit candidate…');
  const commitCandidate = buildCommitCandidate(allPatches, input);

  if (commitCandidate) {
    console.log(`  Suggested message : ${commitCandidate.suggestedMessage}`);
    console.log(`  Files             : ${commitCandidate.files.join(', ')}`);
    console.log(`  Git command       : ${commitCandidate.gitCommand}`);
    console.log('  ⚠️ Actual commit NOT executed. Apply patches and run the git command above after review.');
  } else {
    console.log('  No patches → commit candidate not generated.');
  }

  const summary = {
    toolMeta: TOOL_META,
    dryRun: false,
    input,
    inboxPlan,
    routing,
    geminiResults,
    patches: allPatches,
    verifyPassed,
    verifySkipped,
    commitCandidate,
    safety: {
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      commitTagPushRequiresYes: true,
      actualCommitNotExecuted: true,
    },
    dispatchedAt: new Date().toISOString(),
  };

  if (output) {
    fs.writeFileSync(output, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Results saved to ${output}`);
  }

  console.log('\n✅ Pipeline complete (commit candidate pending review)');
  return summary;
}

module.exports = { TOOL_META, parseArgs, buildCommitCandidate, run };

if (require.main === module) {
  run(process.argv).catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}
