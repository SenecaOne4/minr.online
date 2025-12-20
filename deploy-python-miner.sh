#!/bin/bash
# Deploy Python Miner Installer to Server

set -e

echo "=========================================="
echo "Deploying Python Miner Installer to Server"
echo "=========================================="
echo ""

# Load SSH config from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

SSH_HOST="${SSH_HOST:-root@134.199.243.55}"
SSH_KEY="${SSH_KEY_PATH:-}"
SSH_PASSWORD="${SSH_PASSWORD:-}"

echo "Connecting to server: $SSH_HOST"
echo ""

# SSH command with optional key or password
SSH_CMD="ssh -o StrictHostKeyChecking=accept-new"
if [ -n "$SSH_PASSWORD" ]; then
    # Use sshpass for password authentication
    if command -v sshpass &> /dev/null; then
        SSH_CMD="sshpass -p '$SSH_PASSWORD' ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no"
    else
        echo "Warning: sshpass not installed. Install with: brew install hudochenkov/sshpass/sshpass (Mac) or apt-get install sshpass (Linux)"
        echo "Falling back to interactive password prompt..."
        SSH_CMD="ssh -o StrictHostKeyChecking=accept-new"
    fi
elif [ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ]; then
    SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"
fi

echo "Step 1: Pulling latest code from GitHub..."
$SSH_CMD "$SSH_HOST" "cd /var/www/minr-online && git pull origin main"

echo ""
echo "Step 2: Verifying Python Miner Installer is in source..."
$SSH_CMD "$SSH_HOST" "cd /var/www/minr-online/backend && grep -c 'Python Miner Installer' src/routes/cpu-miner-launcher.ts || echo 'ERROR: Python Miner Installer not found!'"

echo ""
echo "Step 3: Building backend..."
$SSH_CMD "$SSH_HOST" "cd /var/www/minr-online/backend && pnpm build"

echo ""
echo "Step 4: Verifying Python Miner Installer is in built files..."
$SSH_CMD "$SSH_HOST" "cd /var/www/minr-online/backend && find dist -type f -name '*.js' -exec grep -l 'Python Miner Installer' {} \; | head -1 || echo 'ERROR: Python Miner Installer not found in built files!'"

echo ""
echo "Step 5: Stopping old backend process..."
$SSH_CMD "$SSH_HOST" "pkill -9 -f 'node.*backend' || true"
sleep 2

echo ""
echo "Step 6: Starting new backend process..."
$SSH_CMD "$SSH_HOST" "cd /var/www/minr-online/backend && PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &"

sleep 3

echo ""
echo "Step 7: Verifying backend is running..."
$SSH_CMD "$SSH_HOST" "ps aux | grep '[n]ode.*backend' || echo 'ERROR: Backend not running!'"

echo ""
echo "Step 8: Checking backend logs..."
$SSH_CMD "$SSH_HOST" "tail -10 /var/log/minr-backend.log"

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Delete ALL old HTML files from your Downloads folder"
echo "2. Clear browser cache (Cmd+Shift+Delete in Chrome)"
echo "3. Download a NEW HTML file from: https://minr.online/dashboard"
echo "4. The new file should contain 'Python Miner Installer' when you open it"
echo ""

