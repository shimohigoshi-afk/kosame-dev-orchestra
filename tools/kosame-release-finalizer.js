#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { buildFinalizerReport } = require('./kosame-finalizer');
const { buildReleaseRunnerPolicy, classifyReleaseStop } = require('./kosame-release-runner-policy');
const {
  DEFAULT_RELEASE_QUEUE,
  enqueuePendingRelease,
  ensureDefaultReleaseQueue,
  listPendingReleaseQueue,
  resolveQueueDir,
  updatePendingReleaseQueue,
} = require('./kosame-pending-release-queue');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildReleaseFinalizerLane(input = {}) {
  const repoRoot = input.repoRoot || process.cwd();
  const release = {
    id: normalizeText(input.id || DEFAULT_RELEASE_QUEUE[0].id),
    target: normalizeText(input.target || DEFAULT_RELEASE_QUEUE[0].target),
    version: normalizeText(input.version || DEFAULT_RELEASE_QUEUE[0].version),
    feature: normalizeText(input.feature || DEFAULT_RELEASE_QUEUE[0].feature),
    tag: normalizeText(input.tag || DEFAULT_RELEASE_QUEUE[0].tag),
    branch: normalizeText(input.branch || DEFAULT_RELEASE_QUEUE[0].branch),
    changedFiles: Array.isArray(input.changedFiles) && input.changedFiles.length > 0
      ? input.changedFiles.slice()
      : DEFAULT_RELEASE_QUEUE[0].changedFiles.slice(),
    requiredSmokes: Array.isArray(input.requiredSmokes) && input.requiredSmokes.length > 0
      ? input.requiredSmokes.slice()
      : DEFAULT_RELEASE_QUEUE[0].requiredSmokes.slice(),
    releaseActions: Array.isArray(input.releaseActions) && input.releaseActions.length > 0
      ? input.releaseActions.slice()
      : DEFAULT_RELEASE_QUEUE[0].releaseActions.slice(),
    forbidden: Array.isArray(input.forbidden) && input.forbidden.length > 0
      ? input.forbidden.slice()
      : DEFAULT_RELEASE_QUEUE[0].forbidden.slice(),
  };

  const policy = buildReleaseRunnerPolicy({
    target: release.target,
    version: release.version,
    feature: release.feature,
    tag: release.tag,
    releaseBranch: release.branch,
    requiredSmokes: release.requiredSmokes,
    releaseActions: release.releaseActions,
    forbidden: release.forbidden,
    stopInput: input.stopInput || input,
  });
  const stop = classifyReleaseStop(input.stopInput || input);
  const queueOptions = {
    repoRoot,
    queueDir: input.queueDir,
    queueFile: input.queueFile,
  };

  ensureDefaultReleaseQueue(queueOptions);
  const queueEntry = enqueuePendingRelease({
    ...release,
    status: stop.ok ? 'queued' : 'blocked',
    notes: [policy.description, stop.stopSummary].filter(Boolean),
  }, queueOptions);
  const queueSnapshot = listPendingReleaseQueue(queueOptions);
  const finalizer = buildFinalizerReport({
    status: stop.ok ? 'success' : 'partial',
    executor: 'claude-zero-confirm',
    route: 'release-finalizer',
    resultPOST: 'POST /api/releases/finalize 200',
    decisionStatus: stop.ok ? 'ready_for_release' : 'resume_required',
    next: stop.ok ? 'ready_for_release' : stop.nextAction,
    stopReason: stop.stopReason || '',
    gapId: stop.ok ? '' : `release-gap-${release.version}`,
    resumeId: stop.ok ? '' : `release-resume-${release.version}`,
    result_status: stop.ok ? 'success' : 'failed',
    smoke_result: stop.ok ? 'PASS' : 'FAIL',
    verify_result: stop.ok ? 'PASS' : 'FAIL',
    summary: stop.ok
      ? `release lane ready for ${release.version}`
      : `release lane blocked: ${stop.stopSummary}`,
    changed_files: release.changedFiles,
  });

  return {
    repoRoot,
    release,
    policy,
    stop,
    queueEntry,
    queueSnapshot,
    finalizer,
    queueDir: resolveQueueDir(queueOptions),
  };
}

function runReleaseFinalizer(input = {}) {
  return buildReleaseFinalizerLane(input);
}

module.exports = {
  buildReleaseFinalizerLane,
  runReleaseFinalizer,
};

if (require.main === module) {
  const lane = buildReleaseFinalizerLane();
  console.log(JSON.stringify(lane, null, 2));
}
