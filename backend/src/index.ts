import express from 'express';
import { WebSocketServer } from 'ws';
import profileRoutes from './routes/profile';
import membershipRoutes from './routes/membership';
import { handleStratumConnection } from './ws/stratumBridge';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// API routes
app.use('/api/profile', profileRoutes);
app.use('/api/membership', membershipRoutes);

// Create HTTP server from Express app
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws/stratum-browser`);
});

// Create WebSocket server using the HTTP server
const wss = new WebSocketServer({
  server,
  path: '/ws/stratum-browser',
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('[bridge] new ws client');
  handleStratumConnection(ws);
});

