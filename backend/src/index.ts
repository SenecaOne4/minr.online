import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import profileRoutes from './routes/profile';
import membershipRoutes from './routes/membership';
import { setupStratumBridge } from './ws/stratumBridge';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/stratum-browser' });

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

// Setup WebSocket → Stratum bridge
setupStratumBridge(wss);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws/stratum-browser`);
});

