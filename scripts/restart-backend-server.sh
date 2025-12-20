#!/bin/bash
# Restart backend server on minr.online

echo "=== Restarting Backend Server ==="

# Kill all node processes related to backend
echo "1. Killing existing backend processes..."
pkill -9 -f 'node.*backend' || true
sleep 2

# Kill anything on port 3000
echo "2. Freeing port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Verify port is free
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "ERROR: Port 3000 is still in use!"
    exit 1
fi

# Navigate to backend directory
cd /var/www/minr-online/backend || exit 1

# Pull latest code
echo "3. Pulling latest code..."
git pull origin main

# Build
echo "4. Building backend..."
pnpm build

# Start backend
echo "5. Starting backend..."
PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &

# Wait for startup
sleep 4

# Verify it's running
if ps aux | grep -q '[n]ode.*backend'; then
    echo "✓ Backend is running"
    ps aux | grep '[n]ode.*backend' | head -2
    echo ""
    echo "Checking logs..."
    tail -10 /var/log/minr-backend.log | grep -E '(Server running|error|Error)' || tail -5 /var/log/minr-backend.log
else
    echo "ERROR: Backend failed to start!"
    echo "Last 20 lines of log:"
    tail -20 /var/log/minr-backend.log
    exit 1
fi

