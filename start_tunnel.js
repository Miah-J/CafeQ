const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

function startTunnel() {
  console.log('Starting Serveo SSH tunnel...');
  const ssh = spawn('ssh', [
    '-o', 'ServerAliveInterval=60',
    '-o', 'StrictHostKeyChecking=no',
    '-R', '80:localhost:3001',
    'serveo.net'
  ]);

  ssh.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[Serveo Stdout]:', output);
    
    // Find the URL (e.g., https://xxx.serveo.net or https://xxx.serveousercontent.com)
    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9.-]+\.serveo(?:usercontent\.com|\.net)/);
    if (urlMatch) {
      const newUrl = urlMatch[0];
      console.log('=========================================');
      console.log('SUCCESS: Active Tunnel URL:', newUrl);
      console.log('=========================================');
      
      updateEnv(newUrl);
    }
  });

  ssh.stderr.on('data', (data) => {
    console.error('[Serveo Stderr]:', data.toString());
  });

  ssh.on('close', (code) => {
    console.log(`Serveo tunnel exited with code ${code}. Reconnecting in 5 seconds...`);
    setTimeout(startTunnel, 5000);
  });
}

function updateEnv(newUrl) {
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found!');
    return;
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  const callbackUrlRegex = /MPESA_CALLBACK_URL=.*/;
  const newCallbackUrlLine = `MPESA_CALLBACK_URL=${newUrl}/payments/mpesa/callback`;
  
  if (callbackUrlRegex.test(envContent)) {
    const currentLine = envContent.match(callbackUrlRegex)[0];
    if (currentLine === newCallbackUrlLine) {
      console.log('.env already up to date.');
      return;
    }
    envContent = envContent.replace(callbackUrlRegex, newCallbackUrlLine);
  } else {
    envContent += `\n${newCallbackUrlLine}`;
  }
  
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('Updated .env file with new MPESA_CALLBACK_URL.');
  console.log('IMPORTANT: Please restart your backend server if it is running!');
}

startTunnel();
