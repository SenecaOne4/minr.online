#!/bin/bash
# Copy and paste these commands directly into your server console

echo "=========================================="
echo "Deploying Python Miner Installer"
echo "=========================================="

cd /var/www/minr-online
echo "Step 1: Pulling latest code..."
git pull origin main

cd backend
echo ""
echo "Step 2: Verifying Python Miner Installer in source..."
grep -c "Python Miner Installer" src/routes/cpu-miner-launcher.ts

echo ""
echo "Step 3: Building backend..."
pnpm build

echo ""
echo "Step 4: Verifying Python Miner Installer in built files..."
find dist -type f -name "*.js" -exec grep -l "Python Miner Installer" {} \; | head -1

echo ""
echo "Step 5: Stopping old backend..."
pkill -9 -f 'node.*backend' || true
sleep 2

echo ""
echo "Step 6: Starting new backend..."
PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &
sleep 3

echo ""
echo "Step 7: Verifying backend is running..."
ps aux | grep '[n]ode.*backend'

echo ""
echo "Step 8: Checking logs..."
tail -10 /var/log/minr-backend.log

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="

