#!/bin/bash
# Deploy backend update to server

set -e

echo "=== Deploying Backend Update ==="
echo ""

echo "1. Pulling latest code on server..."
ssh root@minr.online "cd /var/www/minr-online && git pull origin main"

echo ""
echo "2. Rebuilding backend..."
ssh root@minr.online "cd /var/www/minr-online/backend && pnpm build"

echo ""
echo "3. Verifying Python Miner Installer in built code..."
ssh root@minr.online "cd /var/www/minr-online/backend && grep -c 'Python Miner Installer' dist/routes/cpu-miner-launcher.js || echo 'ERROR: Python Miner Installer NOT found in built code!'"

echo ""
echo "4. Stopping old backend..."
ssh root@minr.online "pkill -9 -f 'node.*backend' || true"
sleep 2

echo ""
echo "5. Starting new backend..."
ssh root@minr.online "cd /var/www/minr-online/backend && PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &"
sleep 3

echo ""
echo "6. Verifying backend is running..."
ssh root@minr.online "ps aux | grep '[n]ode.*backend' | head -1"

echo ""
echo "7. Checking backend logs..."
ssh root@minr.online "tail -10 /var/log/minr-backend.log"

echo ""
echo "=== Deployment Complete ==="
echo "Now download a fresh HTML launcher from your dashboard!"



