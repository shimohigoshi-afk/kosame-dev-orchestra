/**
 * Smoke test for Gemini Return Routing Pack
 */
const { main } = require('../tools/gemini-return-routing-pack');

console.log('[Smoke Test] Gemini Return Routing Pack Starting...');

main()
  .then(() => {
    console.log('[Smoke Test] PASSED');
  })
  .catch(err => {
    console.error('[Smoke Test] FAILED');
    console.error(err);
    process.exit(1);
  });
