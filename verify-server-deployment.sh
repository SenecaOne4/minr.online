#!/bin/bash
# Script to verify server has latest code deployed

echo "=== Checking Server Deployment ==="
echo ""

echo "1. Checking current commit on server..."
ssh root@minr.online "cd /var/www/minr-online && git log --oneline -1"

echo ""
echo "2. Checking if Python Miner Installer exists in source..."
ssh root@minr.online "cd /var/www/minr-online && grep -n 'Python Miner Installer' backend/src/routes/cpu-miner-launcher.ts | head -1"

echo ""
echo "3. Checking if backend is built..."
ssh root@minr.online "cd /var/www/minr-online/backend && ls -lh dist/routes/cpu-miner-launcher.js 2>&1 | head -1"

echo ""
echo "4. Checking if Python Miner Installer exists in BUILT code..."
ssh root@minr.online "cd /var/www/minr-online/backend && grep -c 'Python Miner Installer' dist/routes/cpu-miner-launcher.js 2>&1"

echo ""
echo "5. Checking backend process..."
ssh root@minr.online "ps aux | grep '[n]ode.*backend' | head -1"

echo ""
echo "=== If Python Miner Installer is NOT found, run: ==="
echo "ssh root@minr.online 'cd /var/www/minr-online && git pull origin main && cd backend && pnpm build && pkill -9 -f node.*backend; sleep 2; PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &'"



