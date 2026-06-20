#!/usr/bin/env node
'use strict';

const CATEGORY_RULES = [
  { category: 'secret', terms: ['secret', 'api key', 'api_key', 'sk-', 'credential', 'credentials', 'password', 'token', 'bearer'], regex: /(?:secret|api[_-]?key|credential|password|token|bearer|sk-[A-Za-z0-9_-]{8,})/i },
  { category: 'env', terms: ['.env', 'env'], regex: /\.env\b/i },
  { category: 'credential', terms: ['credential', 'credentials', 'auth'], regex: /(?:credential|credentials|authorization|auth)/i },
  { category: 'api_key', terms: ['api key', 'api_key'], regex: /(?:api[_-]?key)/i },
  { category: 'token', terms: ['token'], regex: /\btoken\b/i },
  { category: 'password', terms: ['password'], regex: /\bpassword\b/i },
  { category: 'production_deploy', terms: ['production deploy', '本番deploy', 'production'], regex: /(?:production\s+deploy|本番deploy|production\s+launch|production\s+release)/i },
  { category: 'billing', terms: ['billing', '課金', 'payment', 'payments'], regex: /(?:billing|課金|payment|payments)/i },
  { category: 'force_push', terms: ['force push', '--force', '-f'], regex: /(?:git\s+push\s+--force|git\s+push\s+-f|--force\b)/i },
  { category: 'tag_force_update', terms: ['tag -f', 'force tag'], regex: /(?:git\s+tag\s+-f|tag\s+-f)/i },
  { category: 'destructive_delete', terms: ['rm -rf', 'recursive delete', 'delete recursively'], regex: /(?:rm\s+-rf|recursive\s+delete|delete\s+recursively)/i },
  { category: 'sales_dx', terms: ['sales-dx', 'sales dx', '営業dx'], regex: /(?:sales[-\s]?dx|営業dx)/i },
  { category: 'transcriber', terms: ['transcriber'], regex: /\btranscriber\b/i },
  { category: 'customer_data', terms: ['customer data', '顧客情報', '顧客データ'], regex: /(?:customer(?:\s+data|\s+info)?|顧客(?:情報|データ)?)/i },
  { category: 'personal_data', terms: ['個人情報', 'pii'], regex: /(?:個人情報|pii)/i },
  { category: 'external_send', terms: ['外部送信', 'external send', 'send to external'], regex: /(?:外部送信|external\s+send|send\s+to\s+external)/i },
];

function normalizeText(value) {
  return typeof value === 'string' ? value : '';
}

function detectSafetyStop(text) {
  const value = normalizeText(text);
  const categories = [];
  const terms = [];
  const matches = [];
  for (const rule of CATEGORY_RULES) {
    rule.regex.lastIndex = 0;
    const match = rule.regex.exec(value);
    if (!match) continue;
    categories.push(rule.category);
    terms.push(...rule.terms);
    matches.push({ category: rule.category, term: match[0], index: match.index });
  }
  const matched = categories.length > 0;
  return {
    matched,
    categories,
    terms: Array.from(new Set(terms)),
    severity: matched ? 'high' : 'none',
    reason: matched ? `Safety Stop: ${categories.join(', ')}` : '',
    shouldBlock: matched,
    matches,
  };
}

function classifySafetyStop(text) {
  const result = detectSafetyStop(text);
  return {
    ...result,
    promptType: result.matched ? 'safety_stop_prompt' : 'safe_prompt',
  };
}

function hasSafetyStopTerm(text) {
  return detectSafetyStop(text).matched;
}

function summarizeSafetyStop(result) {
  const data = result && typeof result === 'object' ? result : detectSafetyStop(String(result || ''));
  return {
    matched: !!data.matched,
    categories: Array.isArray(data.categories) ? data.categories : [],
    severity: data.severity || 'none',
    reason: data.reason || '',
    shouldBlock: !!data.shouldBlock,
  };
}

module.exports = {
  CATEGORY_RULES,
  detectSafetyStop,
  classifySafetyStop,
  hasSafetyStopTerm,
  summarizeSafetyStop,
};
