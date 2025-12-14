// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { WebSocketServer } from 'ws';
import profileRoutes from './routes/profile';
import membershipRoutes from './routes/membership';
import { handleStratumConnection } from './ws/stratumBridge';

// Optional routes (will be implemented later)
let paymentRoutes: express.Router | null = null;
let adminRoutes: express.Router | null = null;
let analyticsRoutes: express.Router | null = null;
let minerDownloadRoutes: express.Router | null = null;

try {
  paymentRoutes = require('./routes/payments').default;
} catch (e) {
  console.log('[server] Payment routes not available');
}

try {
  adminRoutes = require('./routes/admin').default;
} catch (e) {
  console.log('[server] Admin routes not available');
}

try {
  analyticsRoutes = require('./routes/analytics').default;
} catch (e) {
  console.log('[server] Analytics routes not available');
}

try {
  minerDownloadRoutes = require('./routes/miner-download').default;
} catch (e) {
  console.log('[server] Miner download routes not available');
}

let standaloneMinerRoutes: express.Router | null = null;
try {
  standaloneMinerRoutes = require('./routes/standalone-miner').default;
} catch (e) {
  console.log('[server] Standalone miner routes not available');
}

// Optional services
let startPaymentVerifier: (() => void) | null = null;
let stopPaymentVerifier: (() => void) | null = null;
let startPoolStatsAggregator: (() => void) | null = null;
let stopPoolStatsAggregator: (() => void) | null = null;

try {
  const paymentVerifier = require('./services/paymentVerifier');
  startPaymentVerifier = paymentVerifier.startPaymentVerifier;
  stopPaymentVerifier = paymentVerifier.stopPaymentVerifier;
} catch (e) {
  console.log('[server] Payment verifier service not available');
}

try {
  const poolStats = require('./services/poolStats');
  startPoolStatsAggregator = poolStats.startPoolStatsAggregator;
  stopPoolStatsAggregator = poolStats.stopPoolStatsAggregator;
} catch (e) {
  console.log('[server] Pool stats service not available');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Public routes (no auth required)
import publicSettingsRoutes from './routes/publicSettings';
app.use('/api/admin/settings/public', publicSettingsRoutes);

// Miner config route (requires auth)
import minerConfigRoutes from './routes/miner-config';
app.use('/api/miner-config', minerConfigRoutes);

// Optional routes
if (paymentRoutes) {
  app.use('/api/payments', paymentRoutes);
}
if (adminRoutes) {
  app.use('/api/admin', adminRoutes);
}
if (analyticsRoutes) {
  app.use('/api/analytics', analyticsRoutes);
}
if (minerDownloadRoutes) {
  app.use('/api/miner-download', minerDownloadRoutes);
}
if (standaloneMinerRoutes) {
  app.use('/api/standalone-miner', standaloneMinerRoutes);
}

// Create HTTP server from Express app
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws/stratum-browser`);
  
  // Start background services (if available)
  if (startPaymentVerifier) {
    startPaymentVerifier();
  }
  if (startPoolStatsAggregator) {
    startPoolStatsAggregator();
  }
  
  console.log('[server] Background services started (if available)');
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
  if (stopPaymentVerifier) stopPaymentVerifier();
  if (stopPoolStatsAggregator) stopPoolStatsAggregator();
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received, shutting down gracefully');
  if (stopPaymentVerifier) stopPaymentVerifier();
  if (stopPoolStatsAggregator) stopPoolStatsAggregator();
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
});

