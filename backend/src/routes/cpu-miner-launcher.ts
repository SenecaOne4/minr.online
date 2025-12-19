import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { readFileSync } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

const router: Router = Router();

// Read and base64-encode Python miner script once at module load
function getPythonMinerScriptBase64(): string {
  // Try multiple paths to find the Python script
  const possiblePaths = [
    join(__dirname, '../../../miner-scripts/minr-stratum-miner.py'),
    join(__dirname, '../../../../miner-scripts/minr-stratum-miner.py'),
    join(process.cwd(), 'miner-scripts/minr-stratum-miner.py'),
    '/var/www/minr-online/miner-scripts/minr-stratum-miner.py',
  ];
  
  for (const scriptPath of possiblePaths) {
    if (existsSync(scriptPath)) {
      try {
        const scriptContent = readFileSync(scriptPath, 'utf-8');
        // Base64 encode for safe embedding in bash script
        return Buffer.from(scriptContent, 'utf-8').toString('base64');
      } catch (error) {
        console.error(`[cpu-miner-launcher] Error reading script from ${scriptPath}:`, error);
      }
    }
  }
  
  console.error('[cpu-miner-launcher] Python miner script not found in any expected location');
  return ''; // Return empty string if not found
}

const PYTHON_MINER_SCRIPT_B64 = getPythonMinerScriptBase64();

// GET /api/cpu-miner-launcher - Generate personalized HTML launcher page
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const userEmail = req.user!.email || '';

    // Get or create profile (auto-create if doesn't exist)
    let { data: profile, error: profileError } = await supabase!
      .from('profiles')
      .select('id, has_paid_entry_fee, exempt_from_entry_fee, is_admin, btc_payout_address')
      .eq('id', userId)
      .single();

    // If profile doesn't exist, create it using upsert (safer than insert)
    if (!profile || profileError) {
      console.log('[cpu-miner-launcher] Profile not found, creating with upsert for user:', userId);
      const { data: newProfile, error: createError } = await supabase!
        .from('profiles')
        .upsert(
          {
            id: userId,
            username: null,
            btc_payout_address: null,
          },
          { onConflict: 'id' }
        )
        .select('id, has_paid_entry_fee, exempt_from_entry_fee, is_admin, btc_payout_address')
        .single();

      if (createError) {
        console.error('[cpu-miner-launcher] Error creating profile:', createError);
        return res.status(500).json({ 
          error: 'Failed to create profile',
          details: createError.message 
        });
      }

      if (!newProfile) {
        console.error('[cpu-miner-launcher] Profile upsert returned no data');
        return res.status(500).json({ error: 'Failed to create profile - no data returned' });
      }

      console.log('[cpu-miner-launcher] Profile created successfully:', newProfile.id || userId);
      profile = newProfile;
    }

    // Admins are automatically exempt
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'senecaone4@gmail.com';
    const isAdmin = userEmail === ADMIN_EMAIL || profile.is_admin === true;

    if (!profile.has_paid_entry_fee && !profile.exempt_from_entry_fee && !isAdmin) {
      return res.status(403).json({ error: 'Entry fee payment required to download miner' });
    }

    if (!profile.btc_payout_address) {
      return res.status(400).json({ error: 'BTC payout address not set in profile' });
    }

    // Get auth token from request (we'll need to pass it to the HTML)
    const authHeader = req.headers.authorization;
    const authToken = authHeader?.toString().replace('Bearer ', '') || '';

    // Generate personalized HTML launcher
    const html = generateLauncherHTML({
      userEmail: userEmail,
      authToken: authToken,
      apiUrl: process.env.API_URL || 'https://api.minr.online',
    });

    // Verify HTML was generated
    if (!html || html.length === 0) {
      console.error('[cpu-miner-launcher] Generated HTML is empty');
      return res.status(500).json({ error: 'Failed to generate launcher HTML' });
    }

    console.log('[cpu-miner-launcher] HTML generated successfully, length:', html.length);

    // Send as downloadable HTML file
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="minr-cpu-miner-launcher-${Date.now()}.html"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Length', Buffer.byteLength(html, 'utf8').toString());
    res.send(html);
  } catch (error: any) {
    console.error('[cpu-miner-launcher] Error generating launcher:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cpu-miner-launcher/script - Get Python miner script
router.get('/script', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Resolve path: from dist/routes/ go up to project root, then to miner-scripts
    // In production: /var/www/minr-online/backend/dist/routes/ -> /var/www/minr-online/miner-scripts/
    // Try multiple path resolutions
    let scriptPath = join(__dirname, '../../../miner-scripts/minr-stratum-miner.py');
    if (!existsSync(scriptPath)) {
      // Alternative: from backend/dist/routes/ -> backend/../miner-scripts/
      scriptPath = join(__dirname, '../../../../miner-scripts/minr-stratum-miner.py');
    }
    if (!existsSync(scriptPath)) {
      // Fallback: absolute path (production)
      scriptPath = '/var/www/minr-online/miner-scripts/minr-stratum-miner.py';
    }
    
    if (!existsSync(scriptPath)) {
      console.error('[cpu-miner-launcher] Python script not found at:', scriptPath);
      return res.status(500).json({ error: 'Miner script not found' });
    }
    
    const script = readFileSync(scriptPath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', 'attachment; filename="minr-stratum-miner.py"');
    res.send(script);
  } catch (error: any) {
    console.error('[cpu-miner-launcher] Error reading Python script:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cpu-miner-launcher/install-script/:platform - Get platform-specific install script
router.get('/install-script/:platform', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const platform = req.params.platform; // 'mac', 'linux', 'windows'
    const authHeader = req.headers.authorization;
    const authToken = authHeader?.toString().replace('Bearer ', '') || '';
    const apiUrl = process.env.API_URL || 'https://api.minr.online';

    let script = '';
    let contentType = 'text/plain';
    let filename = '';

    if (platform === 'mac') {
      script = generateMacInstallScript(authToken, apiUrl);
      contentType = 'application/x-sh';
      filename = 'install-minr-miner.sh';
    } else if (platform === 'linux') {
      script = generateLinuxInstallScript(authToken, apiUrl);
      contentType = 'application/x-sh';
      filename = 'install-minr-miner.sh';
    } else if (platform === 'windows') {
      script = generateWindowsInstallScript(authToken, apiUrl);
      contentType = 'application/x-powershell';
      filename = 'install-minr-miner.ps1';
    } else {
      return res.status(400).json({ error: 'Invalid platform. Use: mac, linux, or windows' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(script);
  } catch (error: any) {
    console.error('[cpu-miner-launcher] Error generating install script:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateLauncherHTML(config: {
  userEmail: string;
  authToken: string;
  apiUrl: string;
}): string {
  const { userEmail, authToken, apiUrl } = config;
  
  // Generate and escape scripts at TypeScript level before embedding
  const macScript = generateMacInstallScript(authToken, apiUrl);
  const linuxScript = generateLinuxInstallScript(authToken, apiUrl);
  const windowsScript = generateWindowsInstallScript(authToken, apiUrl);
  // Escape Windows script for PowerShell here-string (escape backticks and $)
  const escapedWindowsScript = windowsScript.replace(/`/g, '``').replace(/\$/g, '`$');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minr.online CPU Miner Launcher</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #111827 100%);
      color: #e5e7eb;
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    
    .subtitle {
      color: #9ca3af;
      font-size: 1.1rem;
    }
    
    .card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
    }
    
    .status {
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
      font-weight: 500;
    }
    
    .status.info {
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.5);
      color: #93c5fd;
    }
    
    .status.success {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.5);
      color: #6ee7b7;
    }
    
    .status.error {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: #fca5a5;
    }
    
    .status.warning {
      background: rgba(251, 191, 36, 0.2);
      border: 1px solid rgba(251, 191, 36, 0.5);
      color: #fde047;
    }
    
    button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
      margin-bottom: 10px;
    }
    
    .btn-primary {
      background: linear-gradient(90deg, #10b981, #059669);
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    
    .btn-secondary {
      background: linear-gradient(90deg, #3b82f6, #2563eb);
      color: white;
    }
    
    .btn-secondary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .log-container {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 15px;
      height: 200px;
      overflow-y: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      margin-top: 15px;
    }
    
    .log-entry {
      margin-bottom: 5px;
      padding: 3px 0;
    }
    
    .log-info { color: #60a5fa; }
    .log-success { color: #10b981; }
    .log-error { color: #ef4444; }
    .log-warning { color: #fbbf24; }
    
    .hidden {
      display: none;
    }
    
    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin: 10px 0;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #059669);
      transition: width 0.3s;
      width: 0%;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Minr.online CPU Miner</h1>
      <p class="subtitle">One-click installation and mining</p>
    </div>
    
    <div class="card">
      <div id="statusContainer">
        <div class="status info" id="statusMessage">
          Ready to install. Click "Install Dependencies" to begin.
        </div>
      </div>
      
      <div class="progress-bar hidden" id="progressBar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      
      <button id="installBtn" class="btn-primary" onclick="startInstallation()">
        🚀 Start Installation (Auto-Run)
      </button>
      
      <button id="mineBtn" class="btn-secondary hidden" onclick="startMining()">
        Show Mining Instructions
      </button>
      
      <div id="miningInstructions" class="hidden mt-4 p-4 bg-gray-800/50 rounded-lg">
        <h3 class="text-white font-semibold mb-2">How to Start Mining:</h3>
        <div id="miningCommand" class="font-mono text-sm text-green-400 bg-black/50 p-3 rounded mb-2"></div>
        <p class="text-xs text-gray-400">Copy and paste this command into your Terminal (Mac/Linux) or PowerShell (Windows)</p>
      </div>
      
      <div class="log-container" id="logContainer">
        <div class="log-entry log-info">Waiting for installation...</div>
      </div>
    </div>
  </div>
  
  <script>
    const CONFIG = {
      userEmail: ${JSON.stringify(userEmail)},
      authToken: ${JSON.stringify(authToken)},
      apiUrl: ${JSON.stringify(apiUrl)},
    };
    
    // Embedded install scripts - everything is in this HTML file!
    const EMBEDDED_SCRIPTS = {
      mac: ${JSON.stringify(macScript)},
      linux: ${JSON.stringify(linuxScript)},
      windows: ${JSON.stringify(windowsScript)},
    };
    
    // Escaped Windows script for PowerShell here-string embedding
    const ESCAPED_WINDOWS_SCRIPT = ${JSON.stringify(escapedWindowsScript)};
    
    let platform = detectPlatform();
    let installScriptPath = '';
    let minerProcess = null;
    let statusCheckInterval = null;
    
    function detectPlatform() {
      const userAgent = navigator.userAgent || navigator.platform || '';
      if (userAgent.includes('Mac')) return 'mac';
      if (userAgent.includes('Win')) return 'windows';
      if (userAgent.includes('Linux')) return 'linux';
      return 'unknown';
    }
    
    function addLog(type, message) {
      const logContainer = document.getElementById('logContainer');
      const entry = document.createElement('div');
      entry.className = \`log-entry log-\${type}\`;
      entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
      logContainer.appendChild(entry);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    function updateStatus(message, type = 'info') {
      const statusEl = document.getElementById('statusMessage');
      statusEl.textContent = message;
      statusEl.className = \`status \${type}\`;
    }
    
    function updateProgress(percent) {
      const progressBar = document.getElementById('progressBar');
      const progressFill = document.getElementById('progressFill');
      progressBar.classList.remove('hidden');
      progressFill.style.width = percent + '%';
    }
    
    async function startInstallation() {
      if (platform === 'unknown') {
        updateStatus('Unable to detect your platform. Please download the script manually.', 'error');
        return;
      }
      
      document.getElementById('installBtn').disabled = true;
      updateStatus('Starting installation...', 'info');
      addLog('info', \`Detected platform: \${platform}\`);
      updateProgress(10);
      
      try {
        // Use embedded script - no download needed!
        addLog('info', 'Using embedded installation script...');
        
        if (!EMBEDDED_SCRIPTS[platform]) {
          throw new Error(\`No embedded script for platform: \${platform}\`);
        }
        
        const scriptText = EMBEDDED_SCRIPTS[platform];
        const scriptBlob = new Blob([scriptText], { type: platform === 'windows' ? 'application/x-powershell' : 'application/x-sh' });
        
        // Get the current file location (where this HTML file is)
        const htmlFilePath = window.location.pathname;
        const htmlFileDir = htmlFilePath.substring(0, htmlFilePath.lastIndexOf('/')) || '.';
        
        // Create platform-specific launcher that opens terminal and runs the script
        if (platform === 'mac') {
          addLog('info', 'Creating Mac launcher...');
          
          // Get the current HTML file's directory (where scripts will be downloaded)
          // If opened as file://, we can get the path; otherwise use Downloads as fallback
          let scriptDir = '';
          if (window.location.protocol === 'file:') {
            const htmlPath = window.location.pathname;
            scriptDir = htmlPath.substring(0, htmlPath.lastIndexOf('/')) || '/';
            addLog('info', \`Detected HTML location: \${scriptDir}\`);
          } else {
            // Web-based: scripts will download to Downloads
            scriptDir = '~/Downloads';
            addLog('info', 'Web-based download - using Downloads folder');
          }
          
          // Download the install script first
          const scriptUrl_local = URL.createObjectURL(scriptBlob);
          const scriptLink = document.createElement('a');
          scriptLink.href = scriptUrl_local;
          scriptLink.download = 'install-minr-miner.sh';
          document.body.appendChild(scriptLink);
          scriptLink.click();
          document.body.removeChild(scriptLink);
          
          // Wait a moment for download to start
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Create a shell script launcher that opens Terminal
          // This script finds its own location and runs install-minr-miner.sh from the same directory
          const launcherScript = \`#!/bin/bash
# Minr.online CPU Miner Launcher v2.0 (No AppleScript)
# Get the directory where this script is located (works regardless of where it's saved)
SCRIPT_DIR="\\$(cd "\\$(dirname "\\$0")" && pwd)"
cd "\\$SCRIPT_DIR"

# Make this script executable (macOS removes execute permissions from downloads)
chmod +x "\\$0"

# Make install script executable (it should be in the same directory)
if [ -f "install-minr-miner.sh" ]; then
    chmod +x install-minr-miner.sh
    
    # Create a .command file that Terminal will execute automatically
    # macOS will run .command files in Terminal when opened
    CMD_FILE="\\$SCRIPT_DIR/run-install.command"
    cat > "\\$CMD_FILE" <<'CMDFILE_EOF'
#!/bin/bash
cd "$(dirname "$0")"
/bin/bash ./install-minr-miner.sh
read -p "Press Enter to close..."
CMDFILE_EOF
    chmod +x "\\$CMD_FILE"
    
    # Open the .command file - macOS will execute it in Terminal automatically
    open "\\$CMD_FILE"
else
    echo "Error: install-minr-miner.sh not found in \\$SCRIPT_DIR"
    echo "Please make sure install-minr-miner.sh is in the same folder as launch-install.sh"
    read -p "Press Enter to close..."
fi\`;
          
          const launcherBlob = new Blob([launcherScript], { type: 'application/x-sh' });
          const launcherUrl = URL.createObjectURL(launcherBlob);
          const launcherLink = document.createElement('a');
          launcherLink.href = launcherUrl;
          launcherLink.download = 'launch-install.sh';
          document.body.appendChild(launcherLink);
          launcherLink.click();
          document.body.removeChild(launcherLink);
          
          addLog('success', 'Scripts downloaded!');
          addLog('info', 'IMPORTANT: After download, run this command in Terminal:');
          addLog('info', 'chmod +x launch-install.sh install-minr-miner.sh');
          addLog('info', 'Then run: ./launch-install.sh');
          updateStatus('Scripts downloaded! Make them executable first (see instructions above)', 'success');
          
          updateProgress(50);
          startStatusPolling();
          
        } else if (platform === 'linux') {
          addLog('info', 'Creating Linux launcher...');
          
          // Create a shell script that opens terminal and runs install
          const launcherScript = \`#!/bin/bash
# Get directory where this script is located
SCRIPT_DIR="\\$(cd "\\$(dirname "\\$0")" && pwd)"
cd "\\$SCRIPT_DIR"

# Detect terminal emulator
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal -- bash -c "curl -s -H 'Authorization: Bearer \${CONFIG.authToken}' '\${scriptUrl}' > install-minr-miner.sh && chmod +x install-minr-miner.sh && ./install-minr-miner.sh; exec bash"
elif command -v xterm &> /dev/null; then
    xterm -e "curl -s -H 'Authorization: Bearer \${CONFIG.authToken}' '\${scriptUrl}' > install-minr-miner.sh && chmod +x install-minr-miner.sh && ./install-minr-miner.sh; exec bash"
elif command -v konsole &> /dev/null; then
    konsole -e bash -c "curl -s -H 'Authorization: Bearer \${CONFIG.authToken}' '\${scriptUrl}' > install-minr-miner.sh && chmod +x install-minr-miner.sh && ./install-minr-miner.sh; exec bash"
else
    echo "No terminal emulator found. Please run manually:"
    echo "curl -s -H 'Authorization: Bearer \${CONFIG.authToken}' '\${scriptUrl}' > install-minr-miner.sh"
    echo "chmod +x install-minr-miner.sh"
    echo "./install-minr-miner.sh"
fi\`;
          
          const launcherBlob = new Blob([launcherScript], { type: 'application/x-sh' });
          const launcherUrl = URL.createObjectURL(launcherBlob);
          const a = document.createElement('a');
          a.href = launcherUrl;
          a.download = 'launch-install.sh';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          addLog('success', 'Launcher downloaded! Run: chmod +x launch-install.sh && ./launch-install.sh');
          updateStatus('Run: chmod +x launch-install.sh && ./launch-install.sh', 'warning');
          updateProgress(50);
          startStatusPolling();
          
        } else if (platform === 'windows') {
          addLog('info', 'Creating Windows launcher...');
          
          // Create PowerShell launcher that opens PowerShell and runs install
          // The install script is already embedded in the HTML, so we just need to write it
          const launcherScript = '# Minr.online Auto-Launcher for Windows\\n' +
            '\\$scriptDir = Split-Path -Parent \\$MyInvocation.MyCommand.Path\\n' +
            'Set-Location \\$scriptDir\\n' +
            '\\n' +
            '# Write embedded install script to file (script content is embedded in HTML)\\n' +
            '\\$installScript = @"\\n' +
            ESCAPED_WINDOWS_SCRIPT + '\\n' +
            '"@\\n' +
            'Set-Content -Path "install-minr-miner.ps1" -Value \\$installScript\\n' +
            'Start-Process powershell -ArgumentList "-NoExit", "-File", "install-minr-miner.ps1"';
          
          const launcherBlob = new Blob([launcherScript], { type: 'application/x-powershell' });
          const launcherUrl = URL.createObjectURL(launcherBlob);
          const a = document.createElement('a');
          a.href = launcherUrl;
          a.download = 'launch-install.ps1';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          addLog('success', 'Launcher downloaded! Right-click launch-install.ps1 and select "Run with PowerShell"');
          updateStatus('Right-click launch-install.ps1 and select "Run with PowerShell"', 'warning');
          updateProgress(50);
          startStatusPolling();
        }
      } catch (error) {
        addLog('error', \`Installation error: \${error.message}\`);
        updateStatus(\`Error: \${error.message}\`, 'error');
        document.getElementById('installBtn').disabled = false;
      }
    }
    
    function startStatusPolling() {
      // Poll for status file (created by install script)
      statusCheckInterval = setInterval(async () => {
        try {
          // Try to read status from local file (via File API - limited)
          // Or use fetch to local server if script creates one
          // For now, we'll use a simple approach: check if script is running
          // In production, the script should create a status endpoint or file
          
          // This is a placeholder - actual implementation depends on how
          // the install script communicates status
          const statusFile = await checkInstallStatus();
          
          // Since we can't directly read the status file from browser,
          // we'll enable the mine button after a reasonable delay
          // User should click it after running the install script
          const installBtn = document.getElementById('installBtn');
          if (installBtn && !installBtn.disabled) {
            // Enable mine button after installation attempt
            setTimeout(() => {
              document.getElementById('mineBtn').classList.remove('hidden');
              updateStatus('After running the install script, click "Show Mining Instructions"', 'info');
            }, 5000);
          }
        } catch (error) {
          // Status check failed, continue polling
        }
      }, 2000);
    }
    
    async function checkInstallStatus() {
      // Check status file created by install script
      // Note: Browser security prevents direct file access, so we'll use a different approach
      // The install script will create a status file, but we can't read it directly from browser
      // Instead, we'll rely on user clicking "Mine!" button after installation
      // In a future enhancement, we could use a local HTTP server or browser extension
      return null;
    }
    
    async function startMining() {
      const instructionsDiv = document.getElementById('miningInstructions');
      const commandDiv = document.getElementById('miningCommand');
      
      if (instructionsDiv && commandDiv) {
        instructionsDiv.classList.remove('hidden');
        
        const detectedPlatform = detectPlatform();
        let command = '';
        
        if (detectedPlatform === 'windows') {
          command = '$HOME\\.minr-online\\start-mining.ps1';
          // Or PowerShell: cd $env:USERPROFILE\\.minr-online; .\\start-mining.ps1
        } else {
          command = '$HOME/.minr-online/start-mining.sh';
        }
        
        commandDiv.textContent = command;
        commandDiv.onclick = () => {
          navigator.clipboard.writeText(command);
          addLog('success', 'Command copied to clipboard!');
        };
        commandDiv.style.cursor = 'pointer';
        commandDiv.title = 'Click to copy';
        
        addLog('info', 'Mining command displayed above. Click it to copy.');
        updateStatus('Copy the command above and run it in Terminal/PowerShell', 'info');
      }
    }
    
    function stopMining() {
      const instructionsDiv = document.getElementById('miningInstructions');
      if (instructionsDiv) {
        instructionsDiv.classList.add('hidden');
      }
      updateStatus('Mining instructions hidden.', 'info');
      addLog('info', 'To stop mining, press Ctrl+C in the terminal where cpuminer is running.');
    }
    
    function startMiningStatsPolling() {
      // Poll for mining statistics
      statusCheckInterval = setInterval(async () => {
        try {
          const stats = await fetchMiningStats();
          if (stats) {
            updateMiningStats(stats);
          }
        } catch (error) {
          // Stats unavailable
        }
      }, 3000);
    }
    
    async function fetchMiningStats() {
      // Fetch stats from local endpoint or file
      // This will be implemented by the install script
      return null;
    }
    
    function updateMiningStats(stats) {
      // Update UI with mining statistics
      // This will be implemented based on stats format
    }
    
    // Auto-start installation if file is opened locally (file:// protocol)
    window.addEventListener('load', () => {
      addLog('info', \`Platform detected: \${platform}\`);
      addLog('info', \`User: \${CONFIG.userEmail}\`);
      
      // Check if opened as local file
      if (window.location.protocol === 'file:') {
        addLog('info', 'Local file detected - ready for auto-installation');
        updateStatus('Click "Start Installation" to begin automatically!', 'info');
      } else {
        addLog('info', 'Opened from web - download will start when you click the button');
        updateStatus('Ready to install. Click "Start Installation" to begin.', 'info');
      }
    });
  </script>
</body>
</html>`;
}

function generateMacInstallScript(authToken: string, apiUrl: string): string {
  const pythonScriptB64 = PYTHON_MINER_SCRIPT_B64;
  return `#!/bin/bash
# Minr.online Python Miner Installer for macOS
# Simple installation - no C build required!

set -e

AUTH_TOKEN="${authToken}"
API_URL="${apiUrl}"
INSTALL_DIR="$HOME/.minr-online"
STATUS_FILE="$INSTALL_DIR/status.json"
LOG_FILE="$INSTALL_DIR/install.log"

mkdir -p "$INSTALL_DIR"
echo "{\\"status\\": \\"installing\\", \\"step\\": \\"Initializing...\\"}" > "$STATUS_FILE"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

update_status() {
    echo "{\\"status\\": \\"$1\\", \\"step\\": \\"$2\\", \\"progress\\": $3}" > "$STATUS_FILE"
}

log "Starting Minr.online Python Miner installation for macOS"

update_status "installing" "Checking Python..." 20

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    log "Python 3 not found. Checking for Homebrew..."
    
    # Check for Homebrew
    if ! command -v brew &> /dev/null; then
        log "Homebrew not found. Installing Homebrew..."
        update_status "installing" "Installing Homebrew..." 30
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
            log "Error installing Homebrew"
            update_status "error" "Failed to install Homebrew" 0
            exit 1
        }
        
        # Add Homebrew to PATH for Apple Silicon Macs
        if [[ -f /opt/homebrew/bin/brew ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    fi
    
    log "Installing Python 3..."
    update_status "installing" "Installing Python 3..." 40
    brew install python3 || {
        log "Error installing Python 3"
        update_status "error" "Failed to install Python 3" 0
        exit 1
    }
else
    log "Python 3 found: $(python3 --version)"
fi

update_status "installing" "Writing miner script..." 60

# Write Python miner script directly (embedded in installer - no API call needed)
MINER_SCRIPT="$INSTALL_DIR/minr-stratum-miner.py"
log "Writing embedded miner script..."

# Decode base64-encoded Python script
echo "${pythonScriptB64}" | base64 -d > "$MINER_SCRIPT" || {
    log "Error: Failed to decode miner script"
    update_status "error" "Failed to write miner script" 0
    exit 1
}

if [ ! -s "$MINER_SCRIPT" ]; then
    log "Error: Miner script file is empty after decoding"
    update_status "error" "Miner script is empty" 0
    exit 1
fi

log "Miner script written successfully ($(wc -l < "$MINER_SCRIPT" | tr -d ' ') lines)"

chmod +x "$MINER_SCRIPT"

update_status "installing" "Fetching configuration..." 80

# Fetch configuration from API
log "Fetching miner configuration..."
CONFIG_FILE="$INSTALL_DIR/config.json"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/miner-config" > "$CONFIG_FILE" || {
    log "Error fetching configuration"
    update_status "error" "Failed to fetch configuration" 0
    exit 1
}

# Parse config to get values for Python script
STRATUM_HOST=$(cat "$CONFIG_FILE" | grep -o '"host": "[^"]*"' | cut -d'"' -f4)
STRATUM_PORT=$(cat "$CONFIG_FILE" | grep -o '"port": [0-9]*' | grep -o '[0-9]*')
WALLET=$(cat "$CONFIG_FILE" | grep -o '"wallet": "[^"]*"' | cut -d'"' -f4)
WORKER=$(cat "$CONFIG_FILE" | grep -o '"worker": "[^"]*"' | cut -d'"' -f4)
USER_EMAIL=$(cat "$CONFIG_FILE" | grep -o '"user_email": "[^"]*"' | cut -d'"' -f4 || echo "user")

# Replace placeholders in Python script
log "Configuring miner script..."
sed -i '' "s|{{USER_EMAIL}}|$USER_EMAIL|g" "$MINER_SCRIPT" 2>/dev/null || \
sed -i "s|{{USER_EMAIL}}|$USER_EMAIL|g" "$MINER_SCRIPT"
sed -i '' "s|{{BTC_WALLET}}|$WALLET|g" "$MINER_SCRIPT" 2>/dev/null || \
sed -i "s|{{BTC_WALLET}}|$WALLET|g" "$MINER_SCRIPT"
sed -i '' "s|{{STRATUM_HOST}}|$STRATUM_HOST|g" "$MINER_SCRIPT" 2>/dev/null || \
sed -i "s|{{STRATUM_HOST}}|$STRATUM_HOST|g" "$MINER_SCRIPT"
sed -i '' "s|{{STRATUM_PORT}}|$STRATUM_PORT|g" "$MINER_SCRIPT" 2>/dev/null || \
sed -i "s|{{STRATUM_PORT}}|$STRATUM_PORT|g" "$MINER_SCRIPT"
sed -i '' "s|{{WORKER_NAME}}|$WORKER|g" "$MINER_SCRIPT" 2>/dev/null || \
sed -i "s|{{WORKER_NAME}}|$WORKER|g" "$MINER_SCRIPT"
sed -i '' "s|{{API_URL}}|$API_URL|g" "$MINER_SCRIPT" 2>/dev/null || \
sed -i "s|{{API_URL}}|$API_URL|g" "$MINER_SCRIPT"
sed -i '' "s|{{AUTH_TOKEN}}|$AUTH_TOKEN|g" "$MINER_SCRIPT" 2>/dev/null || \
sed -i "s|{{AUTH_TOKEN}}|$AUTH_TOKEN|g" "$MINER_SCRIPT"

# Create launcher script
LAUNCHER_SCRIPT="$INSTALL_DIR/start-mining.sh"
cat > "$LAUNCHER_SCRIPT" << 'EOF'
#!/bin/bash
INSTALL_DIR="$HOME/.minr-online"
MINER_SCRIPT="$INSTALL_DIR/minr-stratum-miner.py"

if [ ! -f "$MINER_SCRIPT" ]; then
    echo "Error: Miner script not found. Please run install script again."
    exit 1
fi

# Get number of CPU cores for threading
CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo 1)

# Start mining with all CPU cores
python3 "$MINER_SCRIPT" "$CORES"
EOF

chmod +x "$LAUNCHER_SCRIPT"

log "Installation complete!"
update_status "ready" "Installation complete" 100

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Miner installed to: $INSTALL_DIR"
echo "Start mining with: $LAUNCHER_SCRIPT"
echo ""
echo "Or run directly: python3 $MINER_SCRIPT"
echo ""
`;
}

function generateLinuxInstallScript(authToken: string, apiUrl: string): string {
  const pythonScriptB64 = PYTHON_MINER_SCRIPT_B64;
  return `#!/bin/bash
# Minr.online Python Miner Installer for Linux
# Simple installation - no C build required!

set -e

AUTH_TOKEN="${authToken}"
API_URL="${apiUrl}"
INSTALL_DIR="$HOME/.minr-online"
STATUS_FILE="$INSTALL_DIR/status.json"
LOG_FILE="$INSTALL_DIR/install.log"

mkdir -p "$INSTALL_DIR"
echo "{\\"status\\": \\"installing\\", \\"step\\": \\"Initializing...\\"}" > "$STATUS_FILE"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

update_status() {
    echo "{\\"status\\": \\"$1\\", \\"step\\": \\"$2\\", \\"progress\\": $3}" > "$STATUS_FILE"
}

log "Starting Minr.online Python Miner installation for Linux"

update_status "installing" "Checking Python..." 20

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    log "Python 3 not found. Installing Python 3..."
    update_status "installing" "Installing Python 3..." 30
    
    # Detect Linux distribution
    if [ -f /etc/debian_version ]; then
        DISTRO="debian"
        sudo apt-get update
        sudo apt-get install -y python3 python3-pip || {
            log "Error installing Python 3"
            update_status "error" "Failed to install Python 3" 0
            exit 1
        }
    elif [ -f /etc/redhat-release ]; then
        DISTRO="redhat"
        if command -v dnf &> /dev/null; then
            sudo dnf install -y python3 python3-pip || {
                log "Error installing Python 3"
                update_status "error" "Failed to install Python 3" 0
                exit 1
            }
        else
            sudo yum install -y python3 python3-pip || {
                log "Error installing Python 3"
                update_status "error" "Failed to install Python 3" 0
                exit 1
            }
        fi
    elif [ -f /etc/arch-release ]; then
        DISTRO="arch"
        sudo pacman -S --noconfirm python python-pip || {
            log "Error installing Python 3"
            update_status "error" "Failed to install Python 3" 0
            exit 1
        }
    else
        log "Unknown distribution. Please install Python 3 manually."
        update_status "error" "Unknown distribution - install Python 3 manually" 0
        exit 1
    fi
else
    log "Python 3 found: $(python3 --version)"
fi

update_status "installing" "Writing miner script..." 60

# Write Python miner script directly (embedded in installer - no API call needed)
MINER_SCRIPT="$INSTALL_DIR/minr-stratum-miner.py"
log "Writing embedded miner script..."

# Decode base64-encoded Python script
echo "${pythonScriptB64}" | base64 -d > "$MINER_SCRIPT" || {
    log "Error: Failed to decode miner script"
    update_status "error" "Failed to write miner script" 0
    exit 1
}

if [ ! -s "$MINER_SCRIPT" ]; then
    log "Error: Miner script file is empty after decoding"
    update_status "error" "Miner script is empty" 0
    exit 1
fi

log "Miner script written successfully ($(wc -l < "$MINER_SCRIPT" | tr -d ' ') lines)"

chmod +x "$MINER_SCRIPT"

update_status "installing" "Fetching configuration..." 80

# Fetch configuration from API
log "Fetching miner configuration..."
CONFIG_FILE="$INSTALL_DIR/config.json"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/miner-config" > "$CONFIG_FILE" || {
    log "Error fetching configuration"
    update_status "error" "Failed to fetch configuration" 0
    exit 1
}

# Parse config to get values for Python script
STRATUM_HOST=$(cat "$CONFIG_FILE" | grep -o '"host": "[^"]*"' | cut -d'"' -f4)
STRATUM_PORT=$(cat "$CONFIG_FILE" | grep -o '"port": [0-9]*' | grep -o '[0-9]*')
WALLET=$(cat "$CONFIG_FILE" | grep -o '"wallet": "[^"]*"' | cut -d'"' -f4)
WORKER=$(cat "$CONFIG_FILE" | grep -o '"worker": "[^"]*"' | cut -d'"' -f4)
USER_EMAIL=$(cat "$CONFIG_FILE" | grep -o '"user_email": "[^"]*"' | cut -d'"' -f4 || cat "$CONFIG_FILE" | grep -o '"user": "[^"]*"' | cut -d'"' -f4 || echo "user")

# Replace placeholders in Python script
log "Configuring miner script..."
sed -i "s|{{USER_EMAIL}}|$USER_EMAIL|g" "$MINER_SCRIPT"
sed -i "s|{{BTC_WALLET}}|$WALLET|g" "$MINER_SCRIPT"
sed -i "s|{{STRATUM_HOST}}|$STRATUM_HOST|g" "$MINER_SCRIPT"
sed -i "s|{{STRATUM_PORT}}|$STRATUM_PORT|g" "$MINER_SCRIPT"
sed -i "s|{{WORKER_NAME}}|$WORKER|g" "$MINER_SCRIPT"
sed -i "s|{{API_URL}}|$API_URL|g" "$MINER_SCRIPT"
sed -i "s|{{AUTH_TOKEN}}|$AUTH_TOKEN|g" "$MINER_SCRIPT"

# Create launcher script
LAUNCHER_SCRIPT="$INSTALL_DIR/start-mining.sh"
cat > "$LAUNCHER_SCRIPT" << 'EOF'
#!/bin/bash
INSTALL_DIR="$HOME/.minr-online"
MINER_SCRIPT="$INSTALL_DIR/minr-stratum-miner.py"

if [ ! -f "$MINER_SCRIPT" ]; then
    echo "Error: Miner script not found. Please run install script again."
    exit 1
fi

# Get number of CPU cores for threading
CORES=$(nproc 2>/dev/null || echo 1)

# Start mining with all CPU cores
python3 "$MINER_SCRIPT" "$CORES"
EOF

chmod +x "$LAUNCHER_SCRIPT"

log "Installation complete!"
update_status "ready" "Installation complete" 100

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Miner installed to: $INSTALL_DIR"
echo "Start mining with: $LAUNCHER_SCRIPT"
echo ""
echo "Or run directly: python3 $MINER_SCRIPT"
echo ""
`;
}

function generateWindowsInstallScript(authToken: string, apiUrl: string): string {
  const pythonScriptB64 = PYTHON_MINER_SCRIPT_B64;
  return `# Minr.online Python Miner Installer for Windows
# Simple installation - no C build required!

$ErrorActionPreference = "Stop"

$AUTH_TOKEN = "${authToken}"
$API_URL = "${apiUrl}"
$INSTALL_DIR = "$env:USERPROFILE\\.minr-online"
$STATUS_FILE = "$INSTALL_DIR\\status.json"
$LOG_FILE = "$INSTALL_DIR\\install.log"

New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Update-Status {
    param([string]$Status, [string]$Step, [int]$Progress)
    $statusObj = @{
        status = $Status
        step = $Step
        progress = $Progress
    } | ConvertTo-Json
    Set-Content -Path $STATUS_FILE -Value $statusObj
}

Write-Log "Starting Minr.online Python Miner installation for Windows"

Update-Status "installing" "Checking Python..." 20

# Check for Python 3
if (-not (Get-Command python -ErrorAction SilentlyContinue) -and -not (Get-Command python3 -ErrorAction SilentlyContinue)) {
    Write-Log "Python 3 not found. Installing Python 3..."
    Update-Status "installing" "Installing Python 3..." 30
    
    # Check for Chocolatey
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Log "Chocolatey not found. Installing Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    
    # Install Python via Chocolatey
    choco install -y python3 --ignore-checksums
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Error installing Python 3"
        Update-Status "error" "Failed to install Python 3" 0
        exit 1
    }
    
    # Refresh environment again
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    $pythonCmd = if (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { "python3" }
    $pythonVersion = & $pythonCmd --version
    Write-Log "Python found: $pythonVersion"
}

Update-Status "installing" "Downloading miner script..." 60

# Download Python miner script from API
$MINER_SCRIPT = "$INSTALL_DIR\\minr-stratum-miner.py"
Write-Log "Writing embedded miner script..."
try {
    # Decode base64-encoded Python script
    $scriptB64 = "${pythonScriptB64}"
    $bytes = [System.Convert]::FromBase64String($scriptB64)
    [System.IO.File]::WriteAllBytes($MINER_SCRIPT, $bytes)
} catch {
    Write-Log "Error writing miner script: $_"
    Update-Status "error" "Failed to write miner script" 0
    exit 1
}

if ((Get-Item $MINER_SCRIPT).Length -eq 0) {
    Write-Log "Error: Miner script file is empty"
    Update-Status "error" "Miner script is empty" 0
    exit 1
}

Write-Log "Miner script written successfully"

Update-Status "installing" "Fetching configuration..." 80

# Fetch configuration from API
Write-Log "Fetching miner configuration..."
$CONFIG_FILE = "$INSTALL_DIR\\config.json"
try {
    Invoke-WebRequest -Uri "$API_URL/api/miner-config" -Headers $headers -OutFile $CONFIG_FILE
} catch {
    Write-Log "Error fetching configuration: $_"
    Update-Status "error" "Failed to fetch configuration" 0
    exit 1
}

# Parse config to get values for Python script
$config = Get-Content $CONFIG_FILE | ConvertFrom-Json
$stratumHost = $config.stratum.host
$stratumPort = $config.stratum.port
$wallet = $config.wallet
$worker = $config.worker
$userEmail = if ($config.user_email) { $config.user_email } elseif ($config.user) { $config.user } else { "user" }

# Replace placeholders in Python script
Write-Log "Configuring miner script..."
$scriptContent = Get-Content $MINER_SCRIPT -Raw
$scriptContent = $scriptContent -replace "{{USER_EMAIL}}", $userEmail
$scriptContent = $scriptContent -replace "{{BTC_WALLET}}", $wallet
$scriptContent = $scriptContent -replace "{{STRATUM_HOST}}", $stratumHost
$scriptContent = $scriptContent -replace "{{STRATUM_PORT}}", $stratumPort
$scriptContent = $scriptContent -replace "{{WORKER_NAME}}", $worker
$scriptContent = $scriptContent -replace "{{API_URL}}", $API_URL
$scriptContent = $scriptContent -replace "{{AUTH_TOKEN}}", $AUTH_TOKEN
Set-Content -Path $MINER_SCRIPT -Value $scriptContent

# Create launcher script
$LAUNCHER_SCRIPT = "$INSTALL_DIR\\start-mining.ps1"
$pythonCmd = if (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { "python3" }
$launcherContent = '# Minr.online Python Miner Launcher
$INSTALL_DIR = "$env:USERPROFILE\.minr-online"
$MINER_SCRIPT = "$INSTALL_DIR\minr-stratum-miner.py"

if (-not (Test-Path $MINER_SCRIPT)) {
    Write-Host "Error: Miner script not found. Please run install script again."
    exit 1
}

# Get number of CPU cores
$cores = (Get-WmiObject Win32_ComputerSystem).NumberOfLogicalProcessors

# Start mining with all CPU cores
& ' + $pythonCmd + ' $MINER_SCRIPT $cores'

Set-Content -Path $LAUNCHER_SCRIPT -Value $launcherContent

Write-Log "Installation complete!"
Update-Status "ready" "Installation complete" 100

Write-Host ""
Write-Host "=========================================="
Write-Host "Installation Complete!"
Write-Host "=========================================="
Write-Host ""
Write-Host "Miner installed to: $INSTALL_DIR"
Write-Host "Start mining with: $LAUNCHER_SCRIPT"
Write-Host ""
Write-Host "Or run directly: $pythonCmd $MINER_SCRIPT"
Write-Host ""
`;
}

export default router;

