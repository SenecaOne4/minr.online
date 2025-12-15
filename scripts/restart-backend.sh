#!/bin/bash
# Restart backend service script

echo "=== Restarting Backend Service ==="

# Kill all processes on port 3000
echo "1. Killing processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No processes found on port 3000"
sleep 2

# Verify port is clear
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "ERROR: Port 3000 is still in use!"
  exit 1
fi

echo "2. Port 3000 cleared successfully"

# Navigate to backend directory
cd /var/www/minr-online/backend || exit 1

# Start backend
echo "3. Starting backend..."
PORT=3000 NODE_ENV=production pnpm start > /var/log/minr-backend.log 2>&1 &
BACKEND_PID=$!

sleep 3

# Verify backend started
if ps -p $BACKEND_PID > /dev/null; then
  echo "4. Backend started successfully (PID: $BACKEND_PID)"
  echo "--- Backend log (last 10 lines) ---"
  tail -10 /var/log/minr-backend.log
else
  echo "ERROR: Backend failed to start!"
  echo "--- Backend log (last 20 lines) ---"
  tail -20 /var/log/minr-backend.log
  exit 1
fi

# Test health endpoint
echo "5. Testing health endpoint..."
sleep 2
if curl -s http://127.0.0.1:3000/health | grep -q "ok"; then
  echo "✓ Backend is healthy"
else
  echo "⚠ Backend health check failed (may still be starting)"
fi

echo "=== Backend restart complete ==="

