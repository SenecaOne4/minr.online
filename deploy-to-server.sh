#!/bin/bash
# Deploy backend update to server using credentials from .env

set -e

# Load .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

SSH_HOST="${SSH_HOST:-root@minr.online}"

echo "=== Deploying to $SSH_HOST ==="
echo ""

echo "1. Pulling latest code..."
ssh "$SSH_HOST" "cd /var/www/minr-online && git pull origin main"

echo ""
echo "2. Verifying source has Python Miner Installer..."
ssh "$SSH_HOST" "cd /var/www/minr-online/backend && grep -c 'Python Miner Installer' src/routes/cpu-miner-launcher.ts"

echo ""
echo "3. Rebuilding backend..."
ssh "$SSH_HOST" "cd /var/www/minr-online/backend && pnpm build"

echo ""
echo "4. Verifying build contains Python Miner Installer..."
ssh "$SSH_HOST" "cd /var/www/minr-online/backend && find dist -type f -name '*.js' -exec grep -l 'Python Miner Installer' {} \; | head -1"

echo ""
echo "5. Stopping old backend..."
ssh "$SSH_HOST" "pkill -9 -f 'node.*backend' || true"
sleep 2

echo ""
echo "6. Starting new backend..."
ssh "$SSH_HOST" "cd /var/www/minr-online/backend && PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &"
sleep 3

echo ""
echo "7. Verifying backend is running..."
ssh "$SSH_HOST" "ps aux | grep '[n]ode.*backend' | head -1"

echo ""
echo "8. Checking backend logs..."
ssh "$SSH_HOST" "tail -10 /var/log/minr-backend.log"

echo ""
echo "=== Deployment Complete ==="
echo "Now download a fresh HTML launcher from your dashboard!"



