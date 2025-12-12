// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { WebSocketServer } from 'ws';
import profileRoutes from './routes/profile';
import membershipRoutes from './routes/membership';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import minerDownloadRoutes from './routes/miner-download';
import { handleStratumConnection } from './ws/stratumBridge';
import { startPaymentVerifier, stopPaymentVerifier } from './services/paymentVerifier';
import { startPoolStatsAggregator, stopPoolStatsAggregator } from './services/poolStats';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// CORS middleware (if needed)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Version endpoint - returns git commit hash
app.get('/api/version', (req, res) => {
  const commitHash = process.env.GIT_COMMIT_HASH || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';
  res.json({ 
    commit: commitHash,
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/profile', profileRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/miner-download', minerDownloadRoutes);

// Create HTTP server from Express app
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws/stratum-browser`);
  
  // Start background services
  startPaymentVerifier();
  startPoolStatsAggregator();
  
  console.log('[server] Background services started');
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down gracefully');
  stopPaymentVerifier();
  stopPoolStatsAggregator();
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received, shutting down gracefully');
  stopPaymentVerifier();
  stopPoolStatsAggregator();
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
});

