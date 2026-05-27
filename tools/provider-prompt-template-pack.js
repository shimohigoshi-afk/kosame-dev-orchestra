'use strict';

const TOOL_META = {
  version: '5.4.0',
  title: 'Provider Prompt Template Pack',
  slug: 'provider-prompt-template-pack'
};

const PROMPT_TEMPLATES = {
  claude: {
    role: 'implementation engineer',
    prefix: 'You are a precise implementation engineer. Perform the following task with minimal scope:',
    suffix: 'Do not read secrets, .env, or API key values. Report result as JSON.',
    allowedDataLevels: ['A', 'B']
  },
  gemini: {
    role: 'bulk draft specialist',
    prefix: 'You are a bulk draft specialist. Produce the following content:',
    suffix: 'Use only public or sanitized information. Do not include customer data.',
    allowedDataLevels: ['A']
  },
  grok: {
    role: 'breakthrough analyst',
    prefix: 'You are a breakthrough analyst. Provide alternative designs or recovery plans for:',
    suffix: 'Keep suggestions generic and free of confidential data.',
    allowedDataLevels: ['A']
  },
  deepseek: {
    role: 'fallback code proposer',
    prefix: 'You are a fallback code proposer. Propose sanitized code for:',
    suffix: 'Input must be anonymized. No secrets or customer data allowed.',
    allowedDataLevels: ['A']
  },
  kimi: {
    role: 'long context summarizer',
    prefix: 'You are a long context summarizer. Summarize the following handoff content:',
    suffix: 'Omit any secrets, customer details, or sensitive identifiers.',
    allowedDataLevels: ['A']
  },
  kosame: {
    role: 'PM decision maker',
    prefix: 'こさめ副社長として、以下のタスクを判断してください:',
    suffix: '判断結果をJSON形式で返してください。',
    allowedDataLevels: ['A', 'B', 'C']
  }
};

function getTemplate(provider) {
  return PROMPT_TEMPLATES[provider] || null;
}

function renderTemplate(provider, taskDescription = '', dataLevel = 'A') {
  const tpl = getTemplate(provider);
  if (!tpl) {
    return { ok: false, reason: 'unknown provider', prompt: null };
  }
  if (!tpl.allowedDataLevels.includes(dataLevel)) {
    return { ok: false, reason: `data level ${dataLevel} not allowed for ${provider}`, prompt: null };
  }
  const prompt = `${tpl.prefix}\n\n${taskDescription}\n\n${tpl.suffix}`;
  return { ok: true, provider, role: tpl.role, prompt, dataLevel };
}

function buildPacket(input = {}) {
  const provider = input.provider || 'gemini';
  const taskDescription = input.taskDescription || '(task description here)';
  const dataLevel = input.dataLevel || 'A';
  const rendered = renderTemplate(provider, taskDescription, dataLevel);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    templates: PROMPT_TEMPLATES,
    rendered
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    provider: process.env.KOSAME_PROVIDER || 'gemini',
    taskDescription: process.env.KOSAME_TASK_DESCRIPTION || 'draft a release note',
    dataLevel: process.env.KOSAME_DATA_LEVEL || 'A'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PROMPT_TEMPLATES,
  getTemplate,
  renderTemplate,
  buildPacket
};
