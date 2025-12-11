import { WebSocket } from 'ws';
import * as net from 'net';

const STRATUM_UPSTREAM = process.env.STRATUM_UPSTREAM || 'solo.ckpool.org:3333';

export function setupStratumBridge(wss: any) {
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    // Create TCP connection to Stratum pool
    const [host, port] = STRATUM_UPSTREAM.split(':');
    const tcpSocket = net.createConnection(parseInt(port), host);

    tcpSocket.on('connect', () => {
      console.log(`TCP connection established to ${STRATUM_UPSTREAM}`);
    });

    tcpSocket.on('data', (data: Buffer) => {
      // Forward TCP → WebSocket
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data.toString());
      }
    });

    tcpSocket.on('error', (error: Error) => {
      console.error('TCP socket error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    tcpSocket.on('close', () => {
      console.log('TCP connection closed');
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    // Forward WebSocket → TCP
    ws.on('message', (message: Buffer) => {
      if (tcpSocket.writable) {
        tcpSocket.write(message);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      tcpSocket.end();
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      tcpSocket.end();
    });
  });
}

