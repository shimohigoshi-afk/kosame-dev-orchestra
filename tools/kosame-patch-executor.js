#!/usr/bin/env node
'use strict';

/**
 * KOSAME v110.16 Agent Patch Executor
 *
 * router の結果 (JSON) を読み込み、エージェントの提案をファイルに適用する。
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const TOOL_META = {
  version: '110.16.0',
  slug: 'kosame-patch-executor',
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = prefix => args.find(a => a.startsWith(prefix))?.slice(prefix.length) ?? null;
  return {
    resultFile: get('--result='),
    yes: args.includes('--yes'),
    verify: args.includes('--verify'),
  };
}

function extractPatches(text) {
  const patches = [];
  if (!text) return patches;

  // Pattern 1: [FILE] path/to/file \n ```lang ... ```
  const fileBlocks = text.split(/\[FILE\]\s+/i);
  for (let i = 1; i < fileBlocks.length; i++) {
    const block = fileBlocks[i];
    const lines = block.split('\n');
    const filePath = lines[0].trim();
    const contentMatch = block.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (filePath && contentMatch) {
      patches.push({ file: filePath, content: contentMatch[1] });
    }
  }

  // Pattern 2: simple ```javascript // file: path/to/file ... ```
  const codeBlocks = text.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g);
  for (const match of codeBlocks) {
    const content = match[1];
    const fileHint = content.match(/\/\/ file:\s*([^\n]+)/i) || content.match(/\/\/\s*([^\n]+\.[a-z]{2,4})/i);
    if (fileHint) {
      patches.push({ file: fileHint[1].trim(), content });
    }
  }

  // Pattern 3: JSON-like (e.g. Gemini JSON output)
  try {
    const jsonMatches = text.matchAll(/```json\n([\s\S]*?)```/g);
    for (const jm of jsonMatches) {
      const obj = JSON.parse(jm[1]);
      // Case 1: { diff: [{ file, content }, ...] }
      if (Array.isArray(obj.diff)) {
        obj.diff.forEach(d => {
          if (d.file && d.content) patches.push({ file: d.file, content: d.content });
        });
      }
      // Case 2: { implementation: { fileName, content } }
      if (obj.implementation && obj.implementation.fileName && obj.implementation.content) {
        patches.push({ file: obj.implementation.fileName, content: obj.implementation.content });
      }
      // Case 3: { fileName, fileContent }
      if (obj.fileName && obj.fileContent) {
        patches.push({ file: obj.fileName, content: obj.fileContent });
      }
    }
  } catch (e) {
    // ignore parse errors
  }

  return patches;
}

function applyPatch(patch, rootDir) {
  const fullPath = path.resolve(rootDir, patch.file);
  console.log(`Applying patch to: ${patch.file}`);

  // 既存ファイルがある場合はバックアップ（簡易）
  if (fs.existsSync(fullPath)) {
    const backup = fullPath + '.bak';
    fs.copyFileSync(fullPath, backup);
  }

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, patch.content);
  console.log(`  [OK] Written ${patch.content.length} bytes`);
}

async function run() {
  const { resultFile, yes, verify } = parseArgs(process.argv);
  if (!resultFile) {
    console.error('ERROR: --result=<json_file> is required');
    process.exit(1);
  }

  const raw = fs.readFileSync(resultFile, 'utf8');
  const result = JSON.parse(raw);

  const allPatches = [];
  if (result.gemini) {
    result.gemini.forEach(r => {
      if (r.result && r.result.response) {
        allPatches.push(...extractPatches(r.result.response));
      }
    });
  }

  if (allPatches.length === 0) {
    console.log('No patches found in agent responses.');
    return;
  }

  console.log(`\n===== KOSAME Agent Patch Executor v${TOOL_META.version} =====`);
  console.log(`Found ${allPatches.length} patch(es).`);

  if (!yes) {
    console.log('\nDry run (pass --yes to apply):');
    allPatches.forEach(p => console.log(`  - ${p.file} (${p.content.length} bytes)`));
    return;
  }

  const rootDir = process.cwd();
  for (const patch of allPatches) {
    applyPatch(patch, rootDir);
  }

  if (verify) {
    console.log('\nRunning verification...');
    try {
      execSync('npm run verify', { stdio: 'inherit' });
      console.log('\n✅ Verification PASSED');
    } catch (err) {
      console.error('\n❌ Verification FAILED');
      process.exit(1);
    }
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = { extractPatches, TOOL_META };
