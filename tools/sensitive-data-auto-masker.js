'use strict';

const TOOL_META = {
  version: '110.8.0',
  title: 'Sensitive Data Auto Masker',
  slug: 'sensitive-data-auto-masker'
};

// Mask replacement tokens
const MASK_TOKENS = {
  api_key:           '[MASKED:API_KEY]',
  secret:            '[MASKED:SECRET]',
  token:             '[MASKED:TOKEN]',
  github_credential: '[MASKED:GITHUB_CRED]',
  email_address:     '[MASKED:EMAIL]',
  phone_number:      '[MASKED:PHONE]',
  customer_data:     '[MASKED:CUSTOMER_DATA]',
  insurance_data:    '[MASKED:INSURANCE_DATA]',
  health_data:       '[MASKED:HEALTH_DATA]',
  billing_data:      '[MASKED:BILLING_DATA]',
  contract_data:     '[MASKED:CONTRACT_DATA]',
  ip_address:        '[MASKED:IP_ADDRESS]',
  private_key:       '[MASKED:PRIVATE_KEY]',
  jwt_token:         '[MASKED:JWT]'
};

// Ordered: longer / more specific patterns first to avoid partial matches
const SENSITIVE_PATTERNS = [
  {
    type: 'private_key',
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g
  },
  {
    type: 'github_credential',
    pattern: /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{22,}/g
  },
  {
    type: 'jwt_token',
    pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g
  },
  {
    type: 'api_key',
    pattern: /(?:api[_\-]?key|apikey|api_secret|access[_\-]?key)\s*[:=]\s*["']?([A-Za-z0-9\-_./+]{8,})["']?/gi
  },
  {
    type: 'token',
    pattern: /(?:token|bearer|auth[_\-]?token|access[_\-]?token)\s*[:=]\s*["']?([A-Za-z0-9\-_./+]{8,})["']?/gi
  },
  {
    type: 'secret',
    pattern: /(?:secret|password|passwd|client[_\-]?secret)\s*[:=]\s*["']?(\S{4,})["']?/gi
  },
  {
    type: 'insurance_data',
    pattern: /(?:policy[_\s]?(?:number|no|id)|claim[_\s]?id|insurance[_\s]?(?:no|number|id))\s*[:=]\s*\S+/gi
  },
  {
    type: 'health_data',
    pattern: /(?:patient[_\s]?id|diagnosis|medical[_\s]?(?:record|id)|health[_\s]?data)\s*[:=]\s*\S+/gi
  },
  {
    type: 'billing_data',
    pattern: /(?:credit[_\s]?card|card[_\s]?number|cvv|payment[_\s]?method)\s*[:=]\s*\S+/gi
  },
  {
    type: 'customer_data',
    pattern: /(?:customer[_\s]?(?:id|data|record)|client[_\s]?(?:id|record)|user[_\s]?pii)\s*[:=]\s*\S+/gi
  },
  {
    type: 'email_address',
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  },
  {
    type: 'phone_number',
    pattern: /(?:\+\d{1,3}[\s\-]?)?\(?\d{2,3}\)?[\s\-]?\d{3,4}[\s\-]?\d{4}/g
  },
  {
    type: 'ip_address',
    pattern: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g
  },
  {
    type: 'contract_data',
    pattern: /(?:contract[_\s]?(?:id|number)|nda[_\s]?(?:id|ref)|agreement[_\s]?(?:no|id))\s*[:=]\s*\S+/gi
  }
];

function maskText(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { masked: text, detectedTypes: [], maskCount: 0 };
  }

  let result = text;
  const detectedTypes = new Set();
  let maskCount = 0;

  for (const { type, pattern } of SENSITIVE_PATTERNS) {
    const token = MASK_TOKENS[type] || `[MASKED:${type.toUpperCase()}]`;
    const before = result;
    result = result.replace(pattern, token);
    if (result !== before) {
      detectedTypes.add(type);
      // count occurrences replaced
      const orig = (before.match(pattern) || []).length;
      maskCount += orig;
    }
  }

  return {
    masked: result,
    detectedTypes: Array.from(detectedTypes),
    maskCount
  };
}

function maskObject(obj, path = '') {
  if (obj === null || obj === undefined) return { masked: obj, detectedTypes: [], maskCount: 0 };

  if (typeof obj === 'string') {
    return maskText(obj);
  }

  if (Array.isArray(obj)) {
    const detectedTypes = new Set();
    let maskCount = 0;
    const masked = obj.map((item, i) => {
      const r = maskObject(item, `${path}[${i}]`);
      r.detectedTypes.forEach(t => detectedTypes.add(t));
      maskCount += r.maskCount;
      return r.masked;
    });
    return { masked, detectedTypes: Array.from(detectedTypes), maskCount };
  }

  if (typeof obj === 'object') {
    const detectedTypes = new Set();
    let maskCount = 0;
    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
      const r = maskObject(value, path ? `${path}.${key}` : key);
      r.detectedTypes.forEach(t => detectedTypes.add(t));
      maskCount += r.maskCount;
      masked[key] = r.masked;
    }
    return { masked, detectedTypes: Array.from(detectedTypes), maskCount };
  }

  return { masked: obj, detectedTypes: [], maskCount: 0 };
}

function autoMask(input) {
  const {
    content = null,
    targetProvider = '',
    dryRun = true
  } = input || {};

  const contentType = typeof content === 'string' ? 'text' : 'object';
  const result = contentType === 'text'
    ? maskText(content)
    : maskObject(content);

  const hasSensitiveData = result.detectedTypes.length > 0;

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    humanApprovalRequired: hasSensitiveData,
    targetProvider,
    contentType,
    maskedContent: result.masked,
    detectedTypes: result.detectedTypes,
    maskCount: result.maskCount,
    maskPassed: true,
    sensitiveDataFound: hasSensitiveData,
    maskTokens: MASK_TOKENS
  };
}

function main() {
  const result = autoMask({
    content: 'api_key=sk-abc123secret and customer_id=cust-987 and email user@example.com',
    targetProvider: 'deepseek'
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  MASK_TOKENS,
  SENSITIVE_PATTERNS,
  maskText,
  maskObject,
  autoMask
};
