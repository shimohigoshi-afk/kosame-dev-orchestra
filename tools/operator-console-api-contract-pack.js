/**
 * Operator Console API Contract Pack
 * v0.9.0
 */

function validateApiContract(endpoint, data) {
  const schema = {
    '/operator/status': ['workflowStatus', 'currentVersion', 'riskLevel'],
    '/operator/next-action': ['nextAction']
  };

  const requiredFields = schema[endpoint];
  if (!requiredFields) return { valid: false, error: 'Unknown endpoint' };

  const missingFields = requiredFields.filter(field => !(field in data));
  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

module.exports = { validateApiContract };
