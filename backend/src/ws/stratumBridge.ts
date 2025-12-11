import WebSocket from 'ws';
import net from 'net';

const STRATUM_UPSTREAM = process.env.STRATUM_UPSTREAM || 'solo.ckpool.org:3333';

export function handleStratumConnection(ws: WebSocket): void {
  console.log('WebSocket client connected');

  // Parse upstream address
  const [host, portStr] = STRATUM_UPSTREAM.split(':');
  const port = parseInt(portStr, 10);

  if (!host || !port) {
    console.error(`Invalid STRATUM_UPSTREAM format: ${STRATUM_UPSTREAM}`);
    ws.close(1008, 'Invalid upstream configuration');
    return;
  }

  // Create TCP connection to Stratum pool
  const tcpSocket = net.createConnection(port, host);

  tcpSocket.on('connect', () => {
    console.log(`TCP connection established to ${STRATUM_UPSTREAM}`);
  });

  tcpSocket.on('data', (data: Buffer) => {
    // Forward TCP → WebSocket (as UTF-8 text)
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data.toString('utf8'));
    }
  });

  tcpSocket.on('error', (error: Error) => {
    console.error(`TCP socket error to ${STRATUM_UPSTREAM}:`, error.message);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, 'Upstream connection error');
    }
  });

  tcpSocket.on('close', () => {
    console.log(`TCP connection to ${STRATUM_UPSTREAM} closed`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1001, 'Upstream connection closed');
    }
  });

  // Forward WebSocket → TCP
  ws.on('message', (message: Buffer) => {
    if (tcpSocket.writable) {
      // Send as UTF-8 text to TCP socket
      tcpSocket.write(message.toString('utf8'));
    } else {
      console.warn('TCP socket not writable, dropping message');
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    if (!tcpSocket.destroyed) {
      tcpSocket.end();
    }
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error.message);
    if (!tcpSocket.destroyed) {
      tcpSocket.end();
    }
  });
}

