'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');

function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function writeRuntimeConfig(tmpHome, config) {
  const kosameDir = path.join(tmpHome, '.kosame');
  fs.mkdirSync(kosameDir, { recursive: true });
  fs.writeFileSync(path.join(kosameDir, 'provider-config.json'), JSON.stringify(config, null, 2) + '\n');
}

function loadFreshRuntime(tmpHome) {
  process.env.HOME = tmpHome;
  clearModule('../tools/kosame-cheap-first-runtime');
  return require('../tools/kosame-cheap-first-runtime');
}

function loadFreshAutoRunner(tmpHome) {
  process.env.HOME = tmpHome;
  clearModule('../tools/kosame-auto-runner');
  clearModule('../tools/kosame-cheap-first-runtime');
  return require('../tools/kosame-auto-runner');
}

async function main() {
  console.log('=== v110.40 ai-organization runtime smoke ===');

  const originalHome = process.env.HOME;
  const originalEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  };
  const originalFetch = global.fetch;

  let passed = 0;
  const pass = (msg) => {
    passed += 1;
    console.log(`  PASS: ${msg}`);
  };

  try {
    assert.ok(semverGte(pkg.version, '110.40.0'));
    pass('package version >= 110.40.0');

    const tmpHomeBase = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v11040-'));
    writeRuntimeConfig(tmpHomeBase, { monthlyBudgetUsd: 20, chains: {} });
    const runtime = loadFreshRuntime(tmpHomeBase);

    assert.strictEqual(runtime.TOOL_META.version, '110.41.0');
    pass('runtime TOOL_META.version is 110.41.0');

    assert.ok(runtime.DEFAULT_WORKER_REGISTRY.cheap_code_worker);
    assert.strictEqual(runtime.DEFAULT_WORKER_REGISTRY.cheap_code_worker.modelId, 'deepseek-chat');
    assert.notStrictEqual(runtime.DEFAULT_WORKER_REGISTRY.cheap_code_worker.modelId, 'cheap_code_worker');
    pass('logical worker names are separated from physical model IDs');

    const resolvedGpt = runtime.resolveWorker('gpt-4o', runtime.readConfig());
    const resolvedHaiku = runtime.resolveWorker('claude-haiku-4-5', runtime.readConfig());
    assert.strictEqual(resolvedGpt.workerName, 'gpt_upper');
    assert.strictEqual(resolvedHaiku.workerName, 'claude_haiku');
    pass('migrationAliases map legacy model IDs to worker names');

    const envPresence = runtime.checkEnvPresence(runtime.readConfig());
    assert.ok(Object.prototype.hasOwnProperty.call(envPresence, 'general_worker'));
    pass('startup env presence map is available without API calls');

    const err429 = runtime.classifyApiError(new Error('OpenAI API 429 retry-after:17'));
    const err503 = runtime.classifyApiError(new Error('Gemini API 503 service unavailable'));
    const err401 = runtime.classifyApiError(new Error('Anthropic API 401 unauthorized'));
    const err404 = runtime.classifyApiError(new Error('DeepSeek API 404 model_not_found'));
    assert.strictEqual(err429.type, 'rate_limit');
    assert.strictEqual(err429.ttlMs, 17000);
    assert.strictEqual(err503.type, 'outage');
    assert.ok(err503.ttlMs > 0 && Number.isFinite(err503.ttlMs));
    assert.strictEqual(err401.type, 'auth');
    assert.strictEqual(err404.type, 'not_found');
    pass('429/503/401/404(model_not_found) are classified correctly');

    let cache = runtime.readHealthCache();
    cache = runtime.setWorkerOnLeave('general_worker', { type: 'rate_limit', ttlMs: 1000 }, cache, false);
    const healthPath = path.join(tmpHomeBase, '.kosame', 'provider-health-cache.json');
    assert.ok(fs.existsSync(healthPath));
    const persisted = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
    assert.strictEqual(persisted.workers.general_worker.status, runtime.WSTATUS.ON_LEAVE);
    pass('provider-health-cache.json is written on state changes');

    const recoverable = {
      ...cache,
      workers: {
        ...cache.workers,
        general_worker: {
          ...cache.workers.general_worker,
          retryAfter: new Date(Date.now() - 1000).toISOString(),
        },
      },
    };
    const recovered = runtime.tryAutoRecover(recoverable, true);
    assert.strictEqual(recovered.cache.workers.general_worker.status, runtime.WSTATUS.AVAILABLE);
    pass('503/leave state auto-recovers after TTL');

    const logs = [];
    let notifCache = runtime.emitNotification('same-cause', '原因A', '影響A', '操作A', runtime.readHealthCache(), true, (line) => logs.push(line));
    const firstLogCount = logs.length;
    notifCache = runtime.emitNotification('same-cause', '原因A', '影響A', '操作A', notifCache, true, (line) => logs.push(line));
    assert.strictEqual(logs.length, firstLogCount);
    pass('notification dedup suppresses the same cause within one hour');

    const masked = runtime.maskForDeepSeek('api_key=sk-abcdefghijklmnop user=test@example.com');
    assert.strictEqual(masked.wasModified, true);
    assert.ok(masked.masked.includes('[MASKED:API_KEY]'));
    assert.ok(masked.masked.includes('[MASKED:EMAIL]'));
    pass('DeepSeek prompts are always masked before use');

    const dryRunHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v11040-dryrun-'));
    writeRuntimeConfig(dryRunHome, { monthlyBudgetUsd: 20 });
    const dryRunRuntime = loadFreshRuntime(dryRunHome);
    let dryRunFetchCount = 0;
    global.fetch = async () => {
      dryRunFetchCount += 1;
      throw new Error('fetch should not be called in dryRun');
    };
    const dryRunResult = await dryRunRuntime.cheapFirstRun('compat smoke prompt', 'light', { silent: true });
    assert.strictEqual(dryRunResult.ok, true);
    assert.strictEqual(dryRunResult.dryRun, true);
    assert.strictEqual(dryRunFetchCount, 0);
    pass('dryRun is the default and does not call external APIs');

    const preflightHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v11040-preflight-'));
    writeRuntimeConfig(preflightHome, {
      monthlyBudgetUsd: 20,
      chains: { light: ['general_worker', 'cheap_general_worker'] },
    });
    const preflightRuntime = loadFreshRuntime(preflightHome);
    process.env.OPENAI_API_KEY = 'smoke-openai-key';
    delete process.env.GEMINI_API_KEY;
    let preflightFetchCount = 0;
    global.fetch = async (_url, init) => {
      preflightFetchCount += 1;
      const body = JSON.parse(init.body);
      assert.strictEqual(body.model, 'gpt-4o-mini');
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          choices: [{ message: { content: 'This is a sufficiently long implementation response for the smoke test. It includes enough detail to pass the implementation quality threshold cleanly.' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      };
    };
    const preflightResult = await preflightRuntime.cheapFirstRun('implement a helper module with tests and docs', 'light', {
      dryRun: false,
      silent: true,
      skipHumanGate: true,
      taskType: 'implement',
    });
    const preflightCache = JSON.parse(fs.readFileSync(path.join(preflightHome, '.kosame', 'provider-health-cache.json'), 'utf8'));
    assert.strictEqual(preflightResult.ok, true);
    assert.strictEqual(preflightResult.usedWorker, 'cheap_general_worker');
    assert.strictEqual(preflightFetchCount, 1);
    assert.strictEqual(preflightCache.workers.general_worker.status, runtime.WSTATUS.ISOLATED);
    pass('startup preflight checks env presence and skips missing providers before any API call');

    const singleProviderHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v11040-single-'));
    writeRuntimeConfig(singleProviderHome, {
      monthlyBudgetUsd: 20,
      chains: { light: ['cheap_general_worker', 'gpt_worker'] },
    });
    const singleProviderRuntime = loadFreshRuntime(singleProviderHome);
    process.env.OPENAI_API_KEY = 'smoke-openai-key';
    global.fetch = async () => ({
      ok: false,
      status: 503,
      headers: { get: () => null },
      text: async () => 'service unavailable',
    });
    const singleProviderResult = await singleProviderRuntime.cheapFirstRun('summarize this outage', 'light', {
      dryRun: false,
      silent: true,
      skipHumanGate: false,
      taskType: 'text',
    });
    assert.strictEqual(singleProviderResult.ok, false);
    assert.strictEqual(singleProviderResult.humanGateRequired, false);
    assert.strictEqual(singleProviderResult.blocked, false);
    pass('single-provider failure does not trigger human_gate');

    const multiProviderHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v11040-multi-'));
    writeRuntimeConfig(multiProviderHome, {
      monthlyBudgetUsd: 20,
      chains: { light: ['general_worker', 'cheap_general_worker'] },
    });
    const multiProviderRuntime = loadFreshRuntime(multiProviderHome);
    process.env.GEMINI_API_KEY = 'smoke-gemini-key';
    process.env.OPENAI_API_KEY = 'smoke-openai-key';
    global.fetch = async (_url) => ({
      ok: false,
      status: _url.includes('googleapis') ? 503 : 503,
      headers: { get: () => null },
      text: async () => 'service unavailable',
    });
    const multiProviderResult = await multiProviderRuntime.cheapFirstRun('summarize this outage', 'light', {
      dryRun: false,
      silent: true,
      skipHumanGate: false,
      taskType: 'text',
    });
    assert.strictEqual(multiProviderResult.ok, false);
    assert.strictEqual(multiProviderResult.humanGateRequired, true);
    assert.strictEqual(multiProviderResult.blocked, true);
    pass('human_gate is requested only after all multi-provider fallbacks fail');

    const arbiterHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v11040-arbiter-'));
    writeRuntimeConfig(arbiterHome, { monthlyBudgetUsd: 20 });
    const arbiterRuntime = loadFreshRuntime(arbiterHome);
    process.env.OPENAI_API_KEY = 'smoke-openai-key';
    let arbiterModel = null;
    global.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      arbiterModel = body.model;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          choices: [{ message: { content: 'B' } }],
          usage: { prompt_tokens: 10, completion_tokens: 1 },
        }),
      };
    };
    const arbitration = await arbiterRuntime.arbitrateResponses([
      { workerName: 'cheap_general_worker', response: 'Short answer' },
      { workerName: 'general_worker', response: 'A longer answer that should be selected by the arbiter.' },
    ], 'choose the better answer', arbiterRuntime.readConfig(), false);
    assert.strictEqual(arbiterModel, 'gpt-4o');
    assert.strictEqual(arbitration.winner, 'general_worker');
    pass('final arbitration uses gpt_upper');

    const autoRunnerHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v11040-auto-'));
    writeRuntimeConfig(autoRunnerHome, { monthlyBudgetUsd: 20 });
    const autoRunner = loadFreshAutoRunner(autoRunnerHome);
    global.fetch = async () => {
      throw new Error('auto-runner dryRun must not call fetch');
    };
    const compatTask = await autoRunner.executeTask({
      id: 'compat-1',
      title: 'Backward compatibility task',
      description: 'v110.38 compatible execution path',
      dependencies: [],
      difficulty: 'light',
      executionOrder: 1,
      assignedAI: { model: 'gpt-4o-mini', provider: 'openai' },
    }, { dryRun: true });
    assert.strictEqual(compatTask.success, true);
    assert.strictEqual(compatTask.dryRun, true);
    assert.ok(typeof compatTask.model === 'string' && compatTask.model.length > 0);
    pass('v110.38 kosame-auto-runner remains backward compatible');

    assert.ok(pkg.scripts['smoke:v110-40-ai-organization-runtime']);
    assert.ok(pkg.scripts.verify.includes('smoke:v110-40-ai-organization-runtime'));
    pass('new v110.40 smoke is registered in scripts and verify chain');

    console.log(`PASS: v110.40 ai-organization runtime smoke (${passed} checks)`);
  } finally {
    process.env.HOME = originalHome;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = originalFetch;
    clearModule('../tools/kosame-cheap-first-runtime');
    clearModule('../tools/kosame-auto-runner');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
