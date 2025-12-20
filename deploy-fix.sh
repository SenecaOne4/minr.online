#!/bin/bash
# Complete deployment fix - run this locally

set -e

echo "=== Step 1: Verify local code has Python Miner Installer ==="
LOCAL_COUNT=$(grep -c "Python Miner Installer" backend/src/routes/cpu-miner-launcher.ts || echo "0")
echo "Found $LOCAL_COUNT instances of 'Python Miner Installer' in local file"

if [ "$LOCAL_COUNT" -eq "0" ]; then
    echo "ERROR: Local file doesn't have Python Miner Installer!"
    exit 1
fi

echo ""
echo "=== Step 2: Check git status ==="
git status --short

echo ""
echo "=== Step 3: Stage and commit changes ==="
git add backend/src/routes/cpu-miner-launcher.ts
git commit -m "Fix: Python Miner Installer - ensure all changes committed" || echo "No changes to commit"

echo ""
echo "=== Step 4: Verify commit has Python Miner Installer ==="
COMMIT_COUNT=$(git show HEAD:backend/src/routes/cpu-miner-launcher.ts 2>/dev/null | grep -c "Python Miner Installer" || echo "0")
echo "Found $COMMIT_COUNT instances in HEAD commit"

if [ "$COMMIT_COUNT" -eq "0" ]; then
    echo "ERROR: Commit doesn't have Python Miner Installer!"
    exit 1
fi

echo ""
echo "=== Step 5: Push to GitHub ==="
echo "Attempting to push..."
git push origin main

echo ""
echo "=== Step 6: Verify remote has Python Miner Installer ==="
REMOTE_COUNT=$(git show origin/main:backend/src/routes/cpu-miner-launcher.ts 2>/dev/null | grep -c "Python Miner Installer" || echo "0")
echo "Found $REMOTE_COUNT instances in origin/main"

if [ "$REMOTE_COUNT" -eq "0" ]; then
    echo "WARNING: Remote doesn't have Python Miner Installer yet"
    echo "You may need to push manually or check authentication"
else
    echo "SUCCESS: Remote has Python Miner Installer!"
fi

echo ""
echo "=== Step 7: Deploy to server ==="
echo "Now run these commands on the server:"
echo ""
echo "ssh root@165.227.104.79"
echo "cd /var/www/minr-online"
echo "git pull origin main"
echo "cd backend"
echo "grep -c 'Python Miner Installer' src/routes/cpu-miner-launcher.ts  # Should return 3"
echo "pnpm build"
echo "pkill -9 -f 'node.*backend'"
echo "sleep 2"
echo "PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &"
echo "sleep 3"
echo "ps aux | grep '[n]ode.*backend'"
echo "tail -5 /var/log/minr-backend.log"



