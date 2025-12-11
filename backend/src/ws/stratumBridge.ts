import WebSocket from 'ws';
import net from 'net';

const STRATUM_UPSTREAM = process.env.STRATUM_UPSTREAM || 'solo.ckpool.org:3333';
const BTC_MINING_USERNAME = process.env.BTC_MINING_USERNAME || 'bc1qchm0vkcdkzrstlh05w5zd7j5788yysyfmnlf47';
const BTC_MINING_PASSWORD = process.env.BTC_MINING_PASSWORD || 'x';

export function handleStratumConnection(ws: WebSocket): void {
  console.log('[bridge] WebSocket client connected');

  // Parse upstream address
  const [host, portStr] = STRATUM_UPSTREAM.split(':');
  const port = parseInt(portStr, 10);

  if (!host || !port) {
    console.error(`[bridge] Invalid STRATUM_UPSTREAM format: ${STRATUM_UPSTREAM}`);
    ws.close(1008, 'Invalid upstream configuration');
    return;
  }

  // Create TCP connection to Stratum pool
  const tcpSocket = net.createConnection(port, host);

  tcpSocket.on('connect', () => {
    console.log(`[bridge] TCP connection established to ${STRATUM_UPSTREAM}`);
  });

  tcpSocket.on('data', (data: Buffer) => {
    // Forward TCP → WebSocket (as UTF-8 text)
    const chunk = data.toString('utf8');
    console.log('[bridge] ← upstream', chunk.slice(0, 200));
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk);
    }
  });

  tcpSocket.on('error', (error: Error) => {
    console.error(`[bridge] TCP socket error to ${STRATUM_UPSTREAM}:`, error.message);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, 'Upstream connection error');
    }
  });

  tcpSocket.on('close', () => {
    console.log(`[bridge] TCP connection to ${STRATUM_UPSTREAM} closed`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1001, 'Upstream connection closed');
    }
  });

  // Forward WebSocket → TCP with mining.authorize interception
  ws.on('message', (message: Buffer) => {
    if (!tcpSocket.writable) {
      console.warn('[bridge] TCP socket not writable, dropping message');
      return;
    }

    const messageStr = message.toString('utf8');
    
    // Try to parse as JSON to check for mining.subscribe
    try {
      const parsed = JSON.parse(messageStr);
      
      // Check if this is a mining.subscribe message
      if (parsed && typeof parsed === 'object' && parsed.method === 'mining.subscribe') {
        console.log('[bridge] subscribe from client, sending authorize for', BTC_MINING_USERNAME);
        
        // Forward the original subscribe message to TCP
        tcpSocket.write(messageStr);
        
        // Immediately send mining.authorize with our credentials
        const authorizeMessage = JSON.stringify({
          id: 2,
          method: 'mining.authorize',
          params: [BTC_MINING_USERNAME, BTC_MINING_PASSWORD],
        });
        
        console.log('[bridge] → upstream authorize:', authorizeMessage);
        tcpSocket.write(authorizeMessage + '\n');
        
        return;
      }
    } catch (parseError) {
      // Not JSON or parse failed - forward as-is
      // This handles binary data or malformed JSON gracefully
    }
    
    // Forward all other messages unchanged
    tcpSocket.write(messageStr);
  });

  ws.on('close', () => {
    console.log('[bridge] WebSocket client disconnected');
    if (!tcpSocket.destroyed) {
      tcpSocket.end();
    }
  });

  ws.on('error', (error: Error) => {
    console.error('[bridge] WebSocket error:', error.message);
    if (!tcpSocket.destroyed) {
      tcpSocket.end();
    }
  });
}

