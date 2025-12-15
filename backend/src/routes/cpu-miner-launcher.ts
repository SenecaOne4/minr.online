import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const router: Router = Router();

// GET /api/cpu-miner-launcher - Generate personalized HTML launcher page
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  // #region agent log
  try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:10',message:'Route entry',data:{hasUser:!!req.user,userId:req.user?.id,userEmail:req.user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:10',message:'Route entry',data:{hasUser:!!req.user,userId:req.user?.id,userEmail:req.user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e2){}}
  // #endregion
  try {
    if (!supabase) {
      // #region agent log
      try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:13',message:'Supabase not configured',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:13',message:'Supabase not configured',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e2){}}
      // #endregion
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const userEmail = req.user!.email || '';
    // #region agent log
    try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:18',message:'Before profile query',data:{userId,userEmail,userIdLength:userId.length,userIdType:typeof userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:18',message:'Before profile query',data:{userId,userEmail,userIdLength:userId.length,userIdType:typeof userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n');}catch(e2){}}
    // #endregion

    // Get or create profile (auto-create if doesn't exist)
    let { data: profile, error: profileError } = await supabase!
      .from('profiles')
      .select('id, has_paid_entry_fee, exempt_from_entry_fee, is_admin, btc_payout_address')
      .eq('id', userId)
      .single();

    // #region agent log
    try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:27',message:'After profile query',data:{hasProfile:!!profile,hasError:!!profileError,errorCode:profileError?.code,errorMessage:profileError?.message,errorDetails:profileError?.details,profileId:profile?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:27',message:'After profile query',data:{hasProfile:!!profile,hasError:!!profileError,errorCode:profileError?.code,errorMessage:profileError?.message,errorDetails:profileError?.details,profileId:profile?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e2){}}
    // #endregion

    // If profile doesn't exist, create it using upsert (safer than insert)
    if (!profile || profileError) {
      console.log('[cpu-miner-launcher] Profile not found, creating with upsert for user:', userId);
      // #region agent log
      try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:30',message:'Before upsert',data:{userId,upsertData:{id:userId,username:null,btc_payout_address:null}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:30',message:'Before upsert',data:{userId,upsertData:{id:userId,username:null,btc_payout_address:null}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e2){}}
      // #endregion
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

      // #region agent log
      try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:42',message:'After upsert',data:{hasNewProfile:!!newProfile,hasError:!!createError,errorCode:createError?.code,errorMessage:createError?.message,errorDetails:createError?.details,errorHint:createError?.hint,newProfileId:newProfile?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:42',message:'After upsert',data:{hasNewProfile:!!newProfile,hasError:!!createError,errorCode:createError?.code,errorMessage:createError?.message,errorDetails:createError?.details,errorHint:createError?.hint,newProfileId:newProfile?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e2){}}
      // #endregion

      if (createError) {
        console.error('[cpu-miner-launcher] Error creating profile:', createError);
        // #region agent log
        try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:45',message:'Upsert error returned',data:{errorCode:createError.code,errorMessage:createError.message,errorDetails:createError.details,errorHint:createError.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:45',message:'Upsert error returned',data:{errorCode:createError.code,errorMessage:createError.message,errorDetails:createError.details,errorHint:createError.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e2){}}
        // #endregion
        return res.status(500).json({ 
          error: 'Failed to create profile',
          details: createError.message 
        });
      }

      if (!newProfile) {
        console.error('[cpu-miner-launcher] Profile upsert returned no data');
        // #region agent log
        try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:52',message:'Upsert returned no data',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:52',message:'Upsert returned no data',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e2){}}
        // #endregion
        return res.status(500).json({ error: 'Failed to create profile - no data returned' });
      }

      console.log('[cpu-miner-launcher] Profile created successfully:', newProfile.id || userId);
      // #region agent log
      try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'cpu-miner-launcher.ts:56',message:'Profile created successfully',data:{newProfileId:newProfile.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'cpu-miner-launcher.ts:56',message:'Profile created successfully',data:{newProfileId:newProfile.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e2){}}
      // #endregion
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
        
        const scriptText = await scriptResponse.text();
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
          
          // Create a shell script launcher that opens Terminal
          // This script finds its own location and runs install-minr-miner.sh from the same directory
          const launcherScript = \`#!/bin/bash
# Get the directory where this script is located (works regardless of where it's saved)
SCRIPT_DIR="\\$(cd "\\$(dirname "\\$0")" && pwd)"
cd "\\$SCRIPT_DIR"

# Make install script executable (it should be in the same directory)
if [ -f "install-minr-miner.sh" ]; then
    chmod +x install-minr-miner.sh
    
    # Open Terminal and run the install script using AppleScript
    osascript -e "tell application \\"Terminal\\"" \\
      -e "activate" \\
      -e "set currentTab to do script \\"cd \\\\\\"\\$SCRIPT_DIR\\\\\\" && ./install-minr-miner.sh\\"" \\
      -e "end tell"
else
    echo "Error: install-minr-miner.sh not found in \\$SCRIPT_DIR"
    osascript -e "display dialog \\"Error: install-minr-miner.sh not found in the same folder as launch-install.sh\\" buttons {\\"OK\\"} default button \\"OK\\""
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
          addLog('info', 'Creating auto-launcher...');
          
          // Create an AppleScript that finds launch-install.sh in the same directory as the AppleScript file
          setTimeout(() => {
            const appleScriptContent = \`-- Auto-launcher for Minr.online CPU Miner
-- This script finds launch-install.sh in the same directory and runs it
tell application "Finder"
    set scriptPath to path to me
    set scriptDir to container of scriptPath
    set launcherPath to (scriptDir as string) & "launch-install.sh"
    set launcherPosixPath to POSIX path of launcherPath
end tell

tell application "Terminal"
    activate
    set scriptDirPosix to POSIX path of (scriptDir as alias)
    do shell script "chmod +x " & quoted form of launcherPosixPath
    set currentTab to do script "cd " & quoted form of scriptDirPosix & " && " & quoted form of launcherPosixPath
end tell\`;
            
            const appleScriptBlob = new Blob([appleScriptContent], { type: 'text/plain' });
            const appleScriptUrl = URL.createObjectURL(appleScriptBlob);
            const appleScriptLink = document.createElement('a');
            appleScriptLink.href = appleScriptUrl;
            appleScriptLink.download = 'open-terminal.applescript';
            document.body.appendChild(appleScriptLink);
            appleScriptLink.click();
            document.body.removeChild(appleScriptLink);
            
            addLog('info', 'All files downloaded! Double-click "open-terminal.applescript" to start!');
            addLog('info', 'Make sure all files (HTML, .sh, .applescript) are in the same folder!');
            updateStatus('Double-click open-terminal.applescript to start!', 'success');
          }, 1000);
          
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
          const launcherScript = \`# Minr.online Auto-Launcher for Windows
\\$scriptDir = Split-Path -Parent \\$MyInvocation.MyCommand.Path
Set-Location \\$scriptDir

# Download and run install script
\\$headers = @{
    "Authorization" = "Bearer \${CONFIG.authToken}"
}
Invoke-WebRequest -Uri "\${scriptUrl}" -Headers \\$headers -OutFile "install-minr-miner.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-File", "install-minr-miner.ps1"\`;
          
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

