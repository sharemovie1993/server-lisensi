// utils/caddy.js
const { exec } = require('child_process');
const path = require('path');

function triggerCaddySync() {
  const scriptPath = path.join(__dirname, '../scripts/sync-caddy.js');
  console.log('[Caddy-Sync-Trigger] Running Caddy synchronization in background...');
  exec(`node "${scriptPath}"`, (err, stdout, stderr) => {
    if (err) {
      console.error('[Caddy-Sync-Trigger] Background Caddy sync failed:', stderr || err.message);
    } else {
      console.log('[Caddy-Sync-Trigger] Background Caddy sync completed successfully.');
    }
  });
}

module.exports = { triggerCaddySync };
