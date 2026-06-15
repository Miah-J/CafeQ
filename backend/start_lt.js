const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'lt_url.txt');

(async () => {
  try {
    console.log('Connecting to localtunnel...');
    const tunnel = await localtunnel({ port: 3001 });
    console.log('Tunnel URL:', tunnel.url);
    fs.writeFileSync(outputPath, tunnel.url, 'utf8');
    
    tunnel.on('close', () => {
      console.log('Tunnel closed.');
    });
  } catch (err) {
    console.error('Error starting localtunnel:', err);
    fs.writeFileSync(outputPath, 'ERROR: ' + err.message, 'utf8');
  }
})();
