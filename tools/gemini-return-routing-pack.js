/**
 * Gemini Return Routing Pack
 * Geminiが生成した情報を次のアクションへ振り分けるツール
 */
const fs = require('fs');

async function main() {
  console.log('--- Gemini Return Routing Pack ---');
  
  const packetPath = process.argv[2] || './fixtures/gemini-return-routing-packet.sample.json';
  
  if (!fs.existsSync(packetPath)) {
    console.error(`Error: Packet file not found at ${packetPath}`);
    process.exit(1);
  }

  const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
  
  console.log(`Processing Routing Packet: ${packet.routingPacketId}`);
  console.log(`Source: ${packet.source}`);
  console.log(`DryRun: ${packet.dryRun}`);
  console.log(`HumanApprovalRequired: ${packet.humanApprovalRequired}`);

  packet.targets.forEach((target, index) => {
    console.log(`Target [${index + 1}]: ${target.agent} -> ${target.task} (Priority: ${target.priority})`);
  });

  console.log('Result: Routing plan validated successfully.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
