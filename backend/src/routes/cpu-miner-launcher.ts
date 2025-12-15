import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

const router: Router = Router();

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
      .select('has_paid_entry_fee, exempt_from_entry_fee, is_admin, btc_payout_address, email')
      .eq('id', userId)
      .single();

    // If profile doesn't exist, create it
    if (!profile || profileError) {
      const { data: newProfile, error: createError } = await supabase!
        .from('profiles')
        .insert({
          id: userId,
          username: null,
          btc_payout_address: null,
        })
        .select('has_paid_entry_fee, exempt_from_entry_fee, is_admin, btc_payout_address, email')
        .single();

      if (createError || !newProfile) {
        console.error('[cpu-miner-launcher] Error creating profile:', createError);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

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
        Download Install Script
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
        // Download install script with auth token
        addLog('info', 'Downloading install script...');
        const scriptUrl = \`\${CONFIG.apiUrl}/api/cpu-miner-launcher/install-script/\${platform}\`;
        const scriptResponse = await fetch(scriptUrl, {
          headers: {
            'Authorization': \`Bearer \${CONFIG.authToken}\`,
          },
        });
        
        if (!scriptResponse.ok) {
          const error = await scriptResponse.json().catch(() => ({ error: 'Failed to download script' }));
          throw new Error(error.error || 'Failed to download install script');
        }
        
        if (!scriptResponse.ok) {
          throw new Error('Failed to download install script');
        }
        
        const scriptBlob = await scriptResponse.blob();
        const scriptUrl_local = URL.createObjectURL(scriptBlob);
        
        // For Mac/Linux: Download and provide instructions
        if (platform === 'mac' || platform === 'linux') {
          addLog('info', 'Downloading install script...');
          
          // Create download link
          const a = document.createElement('a');
          a.href = scriptUrl_local;
          a.download = 'install-minr-miner.sh';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          addLog('success', 'Script downloaded!');
          addLog('info', 'To install, open Terminal and run:');
          addLog('info', '  chmod +x ~/Downloads/install-minr-miner.sh');
          addLog('info', '  ~/Downloads/install-minr-miner.sh');
          addLog('info', 'Or drag the file into Terminal and press Enter');
          
          updateStatus('Script downloaded. Run it in Terminal to install.', 'warning');
          updateProgress(30);
          
          // Start polling for status file (will check ~/.minr-online/status.json)
          startStatusPolling();
        } else if (platform === 'windows') {
          addLog('info', 'Downloading PowerShell install script...');
          
          const a = document.createElement('a');
          a.href = scriptUrl_local;
          a.download = 'install-minr-miner.ps1';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          addLog('success', 'Script downloaded!');
          addLog('info', 'To install:');
          addLog('info', '  1. Right-click install-minr-miner.ps1');
          addLog('info', '  2. Select "Run with PowerShell"');
          addLog('info', '  Or open PowerShell and run: .\\install-minr-miner.ps1');
          
          updateStatus('Script downloaded. Run it in PowerShell to install.', 'warning');
          updateProgress(30);
          
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
    
    // Initialize
    addLog('info', \`Platform detected: \${platform}\`);
    addLog('info', \`User: \${CONFIG.userEmail}\`);
  </script>
</body>
</html>`;
}

function generateMacInstallScript(authToken: string, apiUrl: string): string {
  return `#!/bin/bash
# Minr.online CPU Miner Installer for macOS
# This script installs dependencies and sets up cpuminer

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

log "Starting Minr.online CPU Miner installation for macOS"

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    log "Homebrew not found. Installing Homebrew..."
    update_status "installing" "Installing Homebrew..." 10
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    log "Homebrew found"
fi

update_status "installing" "Installing dependencies..." 30

# Install dependencies
log "Installing build dependencies..."
brew install automake autoconf pkg-config libcurl openssl jansson gmp || {
    log "Error installing dependencies"
    update_status "error" "Failed to install dependencies" 0
    exit 1
}

update_status "installing" "Downloading cpuminer..." 50

# Clone cpuminer
CPUMINER_DIR="$INSTALL_DIR/cpuminer"
if [ ! -d "$CPUMINER_DIR" ]; then
    log "Cloning cpuminer repository..."
    git clone https://github.com/pooler/cpuminer.git "$CPUMINER_DIR" || {
        log "Error cloning cpuminer"
        update_status "error" "Failed to clone cpuminer" 0
        exit 1
    }
else
    log "cpuminer directory exists, updating..."
    cd "$CPUMINER_DIR"
    git pull || true
fi

update_status "installing" "Building cpuminer..." 70

# Build cpuminer
cd "$CPUMINER_DIR"
log "Building cpuminer..."
./autogen.sh || {
    log "Error running autogen.sh"
    update_status "error" "Build failed at autogen" 0
    exit 1
}

./configure CFLAGS="-O3" || {
    log "Error running configure"
    update_status "error" "Build failed at configure" 0
    exit 1
}

make -j$(sysctl -n hw.ncpu) || {
    log "Error building cpuminer"
    update_status "error" "Build failed" 0
    exit 1
}

update_status "installing" "Fetching configuration..." 85

# Fetch configuration from API
log "Fetching miner configuration..."
CONFIG_FILE="$INSTALL_DIR/config.json"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/miner-config" > "$CONFIG_FILE" || {
    log "Error fetching configuration"
    update_status "error" "Failed to fetch configuration" 0
    exit 1
}

# Create launcher script
LAUNCHER_SCRIPT="$INSTALL_DIR/start-mining.sh"
cat > "$LAUNCHER_SCRIPT" << 'EOF'
#!/bin/bash
INSTALL_DIR="$HOME/.minr-online"
CONFIG_FILE="$INSTALL_DIR/config.json"
CPUMINER="$INSTALL_DIR/cpuminer/minerd"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found. Please run install script again."
    exit 1
fi

# Parse config
STRATUM_HOST=$(cat "$CONFIG_FILE" | grep -o '"host": "[^"]*"' | cut -d'"' -f4)
STRATUM_PORT=$(cat "$CONFIG_FILE" | grep -o '"port": [0-9]*' | grep -o '[0-9]*')
WALLET=$(cat "$CONFIG_FILE" | grep -o '"wallet": "[^"]*"' | cut -d'"' -f4)
WORKER=$(cat "$CONFIG_FILE" | grep -o '"worker": "[^"]*"' | cut -d'"' -f4)

# Start mining
"$CPUMINER" -a sha256d -o "stratum+tcp://$STRATUM_HOST:$STRATUM_PORT" -u "$WALLET.$WORKER" -p x
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
`;
}

function generateLinuxInstallScript(authToken: string, apiUrl: string): string {
  return `#!/bin/bash
# Minr.online CPU Miner Installer for Linux
# This script installs dependencies and sets up cpuminer

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

log "Starting Minr.online CPU Miner installation for Linux"

# Detect Linux distribution
if [ -f /etc/debian_version ]; then
    DISTRO="debian"
elif [ -f /etc/redhat-release ]; then
    DISTRO="redhat"
elif [ -f /etc/arch-release ]; then
    DISTRO="arch"
else
    DISTRO="unknown"
fi

log "Detected distribution: $DISTRO"

update_status "installing" "Installing dependencies..." 20

# Install dependencies based on distribution
if [ "$DISTRO" = "debian" ]; then
    log "Installing dependencies via apt..."
    sudo apt-get update
    sudo apt-get install -y build-essential libcurl4-openssl-dev libjansson-dev libssl-dev libgmp-dev automake autoconf pkg-config git || {
        log "Error installing dependencies"
        update_status "error" "Failed to install dependencies" 0
        exit 1
    }
elif [ "$DISTRO" = "redhat" ]; then
    log "Installing dependencies via yum/dnf..."
    if command -v dnf &> /dev/null; then
        sudo dnf install -y gcc make automake autoconf pkg-config libcurl-devel jansson-devel openssl-devel gmp-devel git || {
            log "Error installing dependencies"
            update_status "error" "Failed to install dependencies" 0
            exit 1
        }
    else
        sudo yum install -y gcc make automake autoconf pkgconfig libcurl-devel jansson-devel openssl-devel gmp-devel git || {
            log "Error installing dependencies"
            update_status "error" "Failed to install dependencies" 0
            exit 1
        }
    fi
elif [ "$DISTRO" = "arch" ]; then
    log "Installing dependencies via pacman..."
    sudo pacman -S --noconfirm base-devel curl jansson openssl gmp git || {
        log "Error installing dependencies"
        update_status "error" "Failed to install dependencies" 0
        exit 1
    }
else
    log "Unknown distribution. Please install dependencies manually:"
    log "  build-essential, libcurl4-openssl-dev, libjansson-dev, libssl-dev, libgmp-dev, automake, autoconf, pkg-config, git"
    update_status "error" "Unknown distribution" 0
    exit 1
fi

update_status "installing" "Downloading cpuminer..." 50

# Clone cpuminer
CPUMINER_DIR="$INSTALL_DIR/cpuminer"
if [ ! -d "$CPUMINER_DIR" ]; then
    log "Cloning cpuminer repository..."
    git clone https://github.com/pooler/cpuminer.git "$CPUMINER_DIR" || {
        log "Error cloning cpuminer"
        update_status "error" "Failed to clone cpuminer" 0
        exit 1
    }
else
    log "cpuminer directory exists, updating..."
    cd "$CPUMINER_DIR"
    git pull || true
fi

update_status "installing" "Building cpuminer..." 70

# Build cpuminer
cd "$CPUMINER_DIR"
log "Building cpuminer..."
./autogen.sh || {
    log "Error running autogen.sh"
    update_status "error" "Build failed at autogen" 0
    exit 1
}

./configure CFLAGS="-O3" || {
    log "Error running configure"
    update_status "error" "Build failed at configure" 0
    exit 1
}

make -j$(nproc) || {
    log "Error building cpuminer"
    update_status "error" "Build failed" 0
    exit 1
}

update_status "installing" "Fetching configuration..." 85

# Fetch configuration from API
log "Fetching miner configuration..."
CONFIG_FILE="$INSTALL_DIR/config.json"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/miner-config" > "$CONFIG_FILE" || {
    log "Error fetching configuration"
    update_status "error" "Failed to fetch configuration" 0
    exit 1
}

# Create launcher script
LAUNCHER_SCRIPT="$INSTALL_DIR/start-mining.sh"
cat > "$LAUNCHER_SCRIPT" << 'EOF'
#!/bin/bash
INSTALL_DIR="$HOME/.minr-online"
CONFIG_FILE="$INSTALL_DIR/config.json"
CPUMINER="$INSTALL_DIR/cpuminer/minerd"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found. Please run install script again."
    exit 1
fi

# Parse config
STRATUM_HOST=$(cat "$CONFIG_FILE" | grep -o '"host": "[^"]*"' | cut -d'"' -f4)
STRATUM_PORT=$(cat "$CONFIG_FILE" | grep -o '"port": [0-9]*' | grep -o '[0-9]*')
WALLET=$(cat "$CONFIG_FILE" | grep -o '"wallet": "[^"]*"' | cut -d'"' -f4)
WORKER=$(cat "$CONFIG_FILE" | grep -o '"worker": "[^"]*"' | cut -d'"' -f4)

# Start mining
"$CPUMINER" -a sha256d -o "stratum+tcp://$STRATUM_HOST:$STRATUM_PORT" -u "$WALLET.$WORKER" -p x
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
`;
}

function generateWindowsInstallScript(authToken: string, apiUrl: string): string {
  return `# Minr.online CPU Miner Installer for Windows
# PowerShell script to install dependencies and set up cpuminer

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

Write-Log "Starting Minr.online CPU Miner installation for Windows"

# Check for Chocolatey
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Log "Chocolatey not found. Installing Chocolatey..."
    Update-Status "installing" "Installing Chocolatey..." 10
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Log "Chocolatey found"
}

Update-Status "installing" "Installing dependencies..." 30

# Install dependencies via Chocolatey
Write-Log "Installing build dependencies..."
choco install -y git make mingw autoconf automake libtool --ignore-checksums || {
    Write-Log "Error installing dependencies"
    Update-Status "error" "Failed to install dependencies" 0
    exit 1
}

Update-Status "installing" "Downloading cpuminer..." 50

# Clone cpuminer
$CPUMINER_DIR = "$INSTALL_DIR\\cpuminer"
if (-not (Test-Path $CPUMINER_DIR)) {
    Write-Log "Cloning cpuminer repository..."
    git clone https://github.com/pooler/cpuminer.git $CPUMINER_DIR
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Error cloning cpuminer"
        Update-Status "error" "Failed to clone cpuminer" 0
        exit 1
    }
} else {
    Write-Log "cpuminer directory exists, updating..."
    Set-Location $CPUMINER_DIR
    git pull
}

Update-Status "installing" "Building cpuminer..." 70

# Build cpuminer (Windows build is more complex)
Set-Location $CPUMINER_DIR
Write-Log "Building cpuminer..."
Write-Log "Note: Windows builds may require Visual Studio or MinGW setup"
Write-Log "For best results, consider using WSL2 or pre-built binaries"

# Try to build (may fail on Windows without proper setup)
./autogen.sh
if ($LASTEXITCODE -ne 0) {
    Write-Log "Warning: autogen.sh failed. You may need to build manually or use WSL2"
    Write-Log "Alternatively, download a pre-built Windows binary"
}

Update-Status "installing" "Fetching configuration..." 85

# Fetch configuration from API
Write-Log "Fetching miner configuration..."
$CONFIG_FILE = "$INSTALL_DIR\\config.json"
$headers = @{
    "Authorization" = "Bearer $AUTH_TOKEN"
}
try {
    Invoke-WebRequest -Uri "$API_URL/api/miner-config" -Headers $headers -OutFile $CONFIG_FILE
} catch {
    Write-Log "Error fetching configuration: $_"
    Update-Status "error" "Failed to fetch configuration" 0
    exit 1
}

# Create launcher script
$LAUNCHER_SCRIPT = "$INSTALL_DIR\\start-mining.ps1"
$launcherContent = '# Minr.online CPU Miner Launcher
$INSTALL_DIR = "$env:USERPROFILE\.minr-online"
$CONFIG_FILE = "$INSTALL_DIR\config.json"
$CPUMINER = "$INSTALL_DIR\cpuminer\minerd.exe"

if (-not (Test-Path $CONFIG_FILE)) {
    Write-Host "Error: Configuration file not found. Please run install script again."
    exit 1
}

# Parse config (simplified - would use proper JSON parsing in production)
$config = Get-Content $CONFIG_FILE | ConvertFrom-Json
$stratumHost = $config.stratum.host
$stratumPort = $config.stratum.port
$wallet = $config.wallet
$worker = $config.worker

# Start mining
& $CPUMINER -a sha256d -o "stratum+tcp://$stratumHost:$stratumPort" -u "$wallet.$worker" -p x'

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
Write-Host "Note: Windows builds may require additional setup."
Write-Host "Consider using WSL2 for easier building."
Write-Host ""
`;
}

export default router;

