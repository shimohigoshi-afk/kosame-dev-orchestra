/**
 * Local Verify Result Parser Pack
 * v0.6.3
 */

class LocalVerifyResultParser {
  parse(output) {
    const results = {
      summary: 'unknown',
      errors: [],
      passCount: 0,
      failCount: 0
    };

    if (output.includes('PASSED') && !output.includes('FAILED')) {
      results.summary = 'PASS';
    } else if (output.includes('SyntaxError')) {
      results.summary = 'SYNTAX_ERROR';
    } else if (output.includes('AssertionError') || output.includes('FAILED')) {
      results.summary = 'LOGIC_FAIL';
    } else if (output.includes('ENOENT')) {
      results.summary = 'MISSING_FILE';
    }

    // 簡易的なカウント抽出
    const passMatches = output.match(/PASSED/g);
    const failMatches = output.match(/FAILED/g);
    results.passCount = passMatches ? passMatches.length : 0;
    results.failCount = failMatches ? failMatches.length : 0;

    return results;
  }
}

module.exports = { LocalVerifyResultParser };
