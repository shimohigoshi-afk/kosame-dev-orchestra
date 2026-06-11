#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.50 Graduation
 *
 * Verifies:
 *   - Graduation check utility execution
 *   - Version consistency
 */

const { execSync } = require('node:child_process');
const assert = require('node:assert');
const path = require('node:path');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.50 graduation smoke ===');

const checkScript = path.resolve(__dirname, '..', 'tools', 'kosame-graduation-check.js');

try {
  // 1. Execute graduation check
  const output = execSync(`node ${checkScript}`).toString();
  const data = JSON.parse(output);
  
  assert.strictEqual(data.ok, true, 'Result should be ok:true');
  pass('Execution: ok is true');
  
  assert.strictEqual(data.version, '110.50.0', 'Version should match 110.50.0');
  pass('Execution: version matches 110.50.0');

  console.log(`\n✅ v110.50 graduation smoke PASSED (${passed} checks)`);
} catch (e) {
  console.error(`\n❌ smoke FAILED: ${e.message}`);
  process.exit(1);
}
