import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

const router: Router = Router();
const WS_URL = process.env.WS_URL || 'wss://ws.minr.online/ws/stratum-browser';

// GET /api/standalone-miner - Generate personalized standalone HTML miner
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;

    // Check if user has paid entry fee or is exempt
    const { data: profile } = await supabase!
      .from('profiles')
      .select('has_paid_entry_fee, exempt_from_entry_fee, is_admin, btc_payout_address, email')
      .eq('id', userId)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Admins are automatically exempt
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'senecaone4@gmail.com';
    const isAdmin = req.user?.email === ADMIN_EMAIL || profile.is_admin === true;

    if (!profile.has_paid_entry_fee && !profile.exempt_from_entry_fee && !isAdmin) {
      return res.status(403).json({ error: 'Entry fee payment required to download miner' });
    }

    if (!profile.btc_payout_address) {
      return res.status(400).json({ error: 'BTC payout address not set in profile' });
    }

    // Read the worker file
    let workerCode = '';
    try {
      workerCode = readFileSync(join(__dirname, '../../../../frontend/public/miner.worker.js'), 'utf-8');
    } catch (error) {
      console.error('[standalone-miner] Error reading worker file:', error);
      // Fallback to inline worker code if file not found
      workerCode = `// Worker code placeholder - will be embedded inline`;
    }

    // Generate personalized HTML
    const html = generateStandaloneMinerHTML({
      userEmail: profile.email || '',
      btcWallet: profile.btc_payout_address,
      wsUrl: WS_URL,
      workerCode: workerCode,
    });

    // Send as downloadable HTML file
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="minr-miner-${Date.now()}.html"`);
    res.send(html);
  } catch (error: any) {
    console.error('[standalone-miner] Error generating HTML:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateStandaloneMinerHTML(config: {
  userEmail: string;
  btcWallet: string;
  wsUrl: string;
  workerCode: string;
}): string {
  const { userEmail, btcWallet, wsUrl, workerCode } = config;
  
  // Escape the worker code for embedding in HTML
  const escapedWorkerCode = workerCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minr.online - Desktop Miner</title>
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
      max-width: 1200px;
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
    
    .info-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .info-label {
      color: #9ca3af;
      font-weight: 500;
    }
    
    .info-value {
      color: #fff;
      font-family: monospace;
      word-break: break-all;
    }
    
    .controls {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      flex: 1;
      min-width: 150px;
    }
    
    .btn-start {
      background: linear-gradient(90deg, #10b981, #059669);
      color: white;
    }
    
    .btn-start:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    
    .btn-stop {
      background: linear-gradient(90deg, #ef4444, #dc2626);
      color: white;
    }
    
    .btn-stop:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .metric-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    
    .metric-label {
      color: #9ca3af;
      font-size: 0.875rem;
      margin-bottom: 5px;
    }
    
    .metric-value {
      color: #fff;
      font-size: 1.5rem;
      font-weight: bold;
    }
    
    .metric-value.accepted {
      color: #10b981;
    }
    
    .metric-value.rejected {
      color: #ef4444;
    }
    
    .log-container {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 15px;
      height: 300px;
      overflow-y: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
    }
    
    .log-entry {
      margin-bottom: 5px;
      padding: 3px 0;
    }
    
    .log-info { color: #60a5fa; }
    .log-success { color: #10b981; }
    .log-error { color: #ef4444; }
    .log-pool { color: #a78bfa; }
    .log-client { color: #f472b6; }
    
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    
    .status.connected {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }
    
    .status.connecting {
      background: rgba(251, 191, 36, 0.2);
      color: #fbbf24;
    }
    
    .status.disconnected {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    
    .status.mining {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Minr.online Desktop Miner</h1>
      <p class="subtitle">Bitcoin Lottery Pool Mining</p>
    </div>
    
    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Email:</span>
        <span class="info-value">${escapeHtml(userEmail)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">BTC Wallet:</span>
        <span class="info-value">${escapeHtml(btcWallet)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Connection:</span>
        <span class="info-value" id="connectionStatus">Disconnected</span>
      </div>
    </div>
    
    <div class="controls">
      <button id="startBtn" class="btn-start" onclick="startMining()">Start Mining</button>
      <button id="stopBtn" class="btn-stop" onclick="stopMining()" disabled>Stop Mining</button>
    </div>
    
    <div class="metrics">
      <div class="metric-card">
        <div class="metric-label">Hashrate</div>
        <div class="metric-value" id="hashrate">0 H/s</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Hashes</div>
        <div class="metric-value" id="totalHashes">0</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Shares Accepted</div>
        <div class="metric-value accepted" id="acceptedShares">0</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Shares Rejected</div>
        <div class="metric-value rejected" id="rejectedShares">0</div>
      </div>
    </div>
    
    <div class="log-container" id="logContainer">
      <div class="log-entry log-info">Ready to start mining...</div>
    </div>
  </div>
  
  <script>
    // Configuration
    const CONFIG = {
      userEmail: ${JSON.stringify(userEmail)},
      btcWallet: ${JSON.stringify(btcWallet)},
      wsUrl: ${JSON.stringify(wsUrl)},
    };
    
    // State
    let ws = null;
    let worker = null;
    let isMining = false;
    let connectionStatus = 'disconnected';
    let hashesPerSecond = 0;
    let totalHashes = 0;
    let acceptedShares = 0;
    let rejectedShares = 0;
    let currentJob = null;
    let extraNonce = null;
    let submitIdCounter = 3;
    let sessionId = Math.random().toString(36).substring(7);
    
    // Create worker from inline code
    const workerBlob = new Blob([\`${escapedWorkerCode}\`], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    
    function addLog(type, message) {
      const logContainer = document.getElementById('logContainer');
      const entry = document.createElement('div');
      entry.className = \`log-entry log-\${type}\`;
      entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
      logContainer.appendChild(entry);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    function updateStatus(status) {
      connectionStatus = status;
      const statusEl = document.getElementById('connectionStatus');
      statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      statusEl.className = \`status \${status}\`;
    }
    
    function updateMetrics() {
      document.getElementById('hashrate').textContent = formatHashrate(hashesPerSecond);
      document.getElementById('totalHashes').textContent = totalHashes.toLocaleString();
      document.getElementById('acceptedShares').textContent = acceptedShares;
      document.getElementById('rejectedShares').textContent = rejectedShares;
    }
    
    function formatHashrate(hps) {
      if (hps >= 1000000) return (hps / 1000000).toFixed(2) + ' MH/s';
      if (hps >= 1000) return (hps / 1000).toFixed(2) + ' KH/s';
      return hps.toFixed(2) + ' H/s';
    }
    
    function connectWebSocket() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        addLog('info', 'Already connected');
        return;
      }
      
      updateStatus('connecting');
      addLog('info', \`Connecting to \${CONFIG.wsUrl}...\`);
      
      try {
        ws = new WebSocket(CONFIG.wsUrl);
        
        ws.onopen = () => {
          updateStatus('connected');
          addLog('success', 'WebSocket connected');
          
          // Send mining.subscribe
          const subscribeMsg = { id: 1, method: 'mining.subscribe', params: [] };
          ws.send(JSON.stringify(subscribeMsg));
          addLog('client', \`→ \${JSON.stringify(subscribeMsg)}\`);
        };
        
        ws.onmessage = (event) => {
          const lines = event.data.trim().split('\\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              handleStratumMessage(parsed);
            } catch (e) {
              addLog('error', \`Failed to parse: \${line}\`);
            }
          }
        };
        
        ws.onerror = (error) => {
          addLog('error', 'WebSocket error');
          updateStatus('disconnected');
        };
        
        ws.onclose = () => {
          addLog('info', 'WebSocket disconnected');
          updateStatus('disconnected');
          if (isMining) {
            setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
          }
        };
      } catch (error) {
        addLog('error', \`Connection error: \${error.message}\`);
        updateStatus('disconnected');
      }
    }
    
    function handleStratumMessage(parsed) {
      // Handle mining.subscribe response
      if (parsed.id === 1 && parsed.result) {
        const result = parsed.result;
        if (Array.isArray(result) && result.length >= 2) {
          extraNonce = {
            extranonce1: result[1] || '',
            extranonce2Size: result[2] || 4
          };
          addLog('info', \`ExtraNonce: \${extraNonce.extranonce1}, size: \${extraNonce.extranonce2Size}\`);
          
          // Send mining.authorize
          const authorizeMsg = {
            id: 2,
            method: 'mining.authorize',
            params: [CONFIG.btcWallet, 'x']
          };
          ws.send(JSON.stringify(authorizeMsg));
          addLog('client', \`→ \${JSON.stringify(authorizeMsg)}\`);
        }
      }
      
      // Handle mining.authorize response
      if (parsed.id === 2) {
        if (parsed.result === true) {
          addLog('success', 'Authorization successful');
        } else {
          addLog('error', \`Authorization failed: \${parsed.error || 'Unknown error'}\`);
        }
      }
      
      // Handle mining.notify
      if (parsed.method === 'mining.notify') {
        const params = parsed.params || [];
        if (params.length >= 9) {
          currentJob = {
            jobId: params[0],
            prevhash: params[1],
            coinb1: params[2],
            coinb2: params[3],
            merkleBranches: params[4],
            version: params[5],
            nBits: params[6],
            nTime: params[7],
            cleanJobs: params[8]
          };
          addLog('info', \`New job: \${currentJob.jobId}\`);
          
          if (isMining && worker) {
            startMiningWorker();
          }
        }
      }
      
      // Handle mining.submit response
      if (parsed.id && parsed.id >= 3 && parsed.id < 100) {
        if (parsed.result === true) {
          addLog('success', \`Share accepted! (ID: \${parsed.id})\`);
          acceptedShares++;
        } else {
          addLog('error', \`Share rejected: \${parsed.error || 'Unknown error'} (ID: \${parsed.id})\`);
          rejectedShares++;
        }
        updateMetrics();
      }
    }
    
    function startMiningWorker() {
      if (!currentJob || !extraNonce || !worker) return;
      
      worker.postMessage({
        type: 'start',
        job: currentJob,
        extraNonce: extraNonce,
        nonceStart: Math.floor(Math.random() * 0xFFFFFFFF),
        nonceStride: 1
      });
    }
    
    function startMining() {
      if (isMining) return;
      
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        addLog('error', 'Not connected to pool. Connecting...');
        connectWebSocket();
        setTimeout(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            startMining();
          } else {
            addLog('error', 'Failed to connect. Please try again.');
          }
        }, 2000);
        return;
      }
      
      if (!worker) {
        worker = new Worker(workerUrl);
        
        worker.onmessage = (e) => {
          const { type, hashesCompleted, hashesPerSecond: hps, share } = e.data;
          
          if (type === 'progress') {
            hashesPerSecond = hps;
            totalHashes += hashesCompleted;
            updateMetrics();
          } else if (type === 'shareFound') {
            if (share && ws && ws.readyState === WebSocket.OPEN) {
              submitShare(share);
            }
          }
        };
        
        worker.onerror = (error) => {
          addLog('error', \`Worker error: \${error.message}\`);
        };
      }
      
      isMining = true;
      updateStatus('mining');
      document.getElementById('startBtn').disabled = true;
      document.getElementById('stopBtn').disabled = false;
      
      addLog('success', 'Mining started');
      
      if (currentJob) {
        startMiningWorker();
      }
    }
    
    function stopMining() {
      if (!isMining) return;
      
      isMining = false;
      updateStatus('connected');
      document.getElementById('startBtn').disabled = false;
      document.getElementById('stopBtn').disabled = true;
      
      if (worker) {
        worker.postMessage({ type: 'stop' });
      }
      
      addLog('info', 'Mining stopped');
    }
    
    function submitShare(share) {
      if (!ws || ws.readyState !== WebSocket.OPEN || !extraNonce) return;
      
      const submitId = submitIdCounter++;
      const workerName = \`minr.\${CONFIG.userEmail.split('@')[0] || 'user'}\`;
      
      const submitMsg = {
        id: submitId,
        method: 'mining.submit',
        params: [
          workerName,
          share.jobId,
          share.extranonce2,
          share.ntime,
          share.nonce
        ]
      };
      
      ws.send(JSON.stringify(submitMsg));
      addLog('client', \`→ Submitted share for job \${share.jobId}\`);
    }
    
    // Initialize connection on load
    window.addEventListener('load', () => {
      addLog('info', 'Desktop miner loaded');
      addLog('info', \`Configured for: \${CONFIG.userEmail}\`);
      connectWebSocket();
    });
    
    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
      if (worker) {
        worker.terminate();
      }
      if (ws) {
        ws.close();
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export default router;

