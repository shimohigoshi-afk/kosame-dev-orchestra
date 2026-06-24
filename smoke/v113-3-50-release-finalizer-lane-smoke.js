const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { buildReleaseFinalizerLane, runReleaseFinalizer } = require('../tools/kosame-release-finalizer');
const { buildReleaseRunnerPolicy, classifyReleaseStop, RELEASE_LANE_FORBIDDEN, RELEASE_LANE_STEPS } = require('../tools/kosame-release-runner-policy');
const {
  enqueuePendingRelease,
  ensureDefaultReleaseQueue,
  listPendingReleaseQueue,
  readPendingReleaseQueue,
  takeNextPendingRelease,
} = require('../tools/kosame-pending-release-queue');

function main() {
  console.log('===== v113-3-50 release finalizer lane smoke =====');

  assert.ok(pkg.scripts['kosame:release-finalizer'], 'kosame:release-finalizer script must exist');
  assert.ok(pkg.scripts['smoke:v113-3-50-release-finalizer-lane'], 'smoke:v113-3-50-release-finalizer-lane script must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-50-release-finalizer-lane'), 'verify must include release finalizer lane smoke');
  console.log('  PASS package wiring');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-release-finalizer-'));
  const queueDir = path.join(tmpRoot, '.kosame-release-queue');
  const release = {
    target: '② 不動産価格検索',
    version: 'v113.3.50',
    feature: 'feat/v113-3-50-real-estate-nationwide-area-price-rent-estimate-lite',
    tag: 'v113.3.50',
    branch: 'main',
    changedFiles: [
      'public/fk-omiya-console.html',
      'package.json',
      'smoke/v113-3-50-fk-omiya-realestate-nationwide-area-price-rent-estimate-lite-smoke.js',
    ],
    requiredSmokes: [
      'npm run smoke:v113-3-50',
      'npm run smoke:v113-3-49',
      'npm run smoke:v113-3-48',
      'npm run smoke:v113-3-47',
      'npm run smoke:v113-3-38',
      'npm run smoke:v113-3-39',
      'npm run verify',
    ],
  };

  const lane = buildReleaseFinalizerLane({
    repoRoot: path.resolve(__dirname, '..'),
    queueDir,
    ...release,
    stopInput: { stderr: 'runner timeout after 30000ms' },
  });
  assert.equal(lane.release.version, 'v113.3.50');
  assert.equal(lane.policy.humanApprovalRequired, false);
  assert.equal(lane.policy.commitTagPushRequiresYes, false);
  assert.ok(Array.isArray(lane.policy.laneSteps) && lane.policy.laneSteps.length >= 5, 'lane steps must exist');
  assert.ok(lane.finalizer.finalReport.includes('KOSAME_RESULT_BEGIN'), 'finalizer report must include result block');
  assert.equal(lane.stop.category, 'runner_timeout');
  assert.equal(lane.stop.nextAction, 'resume_runner_lane');
  assert.equal(lane.queueEntry.version, 'v113.3.50');
  assert.equal(lane.queueEntry.target, '② 不動産価格検索');
  assert.ok(fs.existsSync(path.join(queueDir, 'pending-release-queue.json')), 'queue file must be saved');
  console.log('  PASS release finalizer lane builder');

  const queue = readPendingReleaseQueue({ queueDir });
  assert.ok(Array.isArray(queue) && queue.length >= 1, 'queue must contain entry');
  const entry = queue[queue.length - 1];
  assert.equal(entry.version, 'v113.3.50');
  assert.equal(entry.feature, 'feat/v113-3-50-real-estate-nationwide-area-price-rent-estimate-lite');
  assert.ok(entry.requiredSmokes.includes('npm run smoke:v113-3-50'));
  assert.ok(entry.releaseActions.includes('mainへmerge'));
  assert.ok(entry.releaseActions.includes('Actions確認'));
  assert.ok(entry.forbidden.includes('.env'));
  assert.ok(entry.forbidden.includes('営業DX'));
  assert.ok(entry.forbidden.includes('SUUMO'));
  console.log('  PASS pending release queue');

  const pol = buildReleaseRunnerPolicy({
    version: 'v113.3.50',
    feature: release.feature,
    target: release.target,
    tag: release.tag,
    stopInput: { stderr: 'verify failed: smoke failed' },
  });
  assert.ok(pol.releaseActions.includes('tag送信'));
  assert.ok(pol.requiredSmokes.includes('npm run verify'));
  assert.ok(pol.forbidden.includes('force push'));
  assert.ok(RELEASE_LANE_STEPS.includes('merge_main'));
  assert.ok(RELEASE_LANE_FORBIDDEN.includes('Google Maps本番接続'));
  assert.equal(classifyReleaseStop({ stderr: 'runner timeout after 30000ms' }).classification, 'runner_timeout');
  assert.equal(classifyReleaseStop({ stderr: 'verify failed: smoke failed' }).classification, 'verify_failed');
  console.log('  PASS release runner policy');

  const enq = enqueuePendingRelease(release, { queueDir });
  assert.equal(enq.version, 'v113.3.50');
  const leased = takeNextPendingRelease({ queueDir });
  assert.ok(leased, 'takeNextPendingRelease must return entry');
  assert.equal(leased.version, 'v113.3.50');
  const queueAfterLease = listPendingReleaseQueue({ queueDir });
  assert.ok(Array.isArray(queueAfterLease), 'queue after lease must be array');
  const fallbackQueue = ensureDefaultReleaseQueue({ queueDir: path.join(tmpRoot, '.default-release-queue') });
  assert.ok(Array.isArray(fallbackQueue) && fallbackQueue.length >= 1, 'default queue seed must exist');
  assert.equal(runReleaseFinalizer({ queueDir }).release.version, 'v113.3.50');
  console.log('  PASS queue operations');

  console.log('✅ v113.3.50 release finalizer lane smoke PASSED');
}

main();
