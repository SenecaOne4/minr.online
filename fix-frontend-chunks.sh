#!/bin/bash
# Fix frontend chunk loading errors by doing a clean rebuild

set -e

cd /var/www/minr-online/frontend

echo "=== Fixing Frontend Chunk Loading ==="
echo "1. Stopping Next.js..."
pkill -9 -f "next start" || true
sleep 2

echo "2. Removing stale build..."
rm -rf .next

echo "3. Installing dependencies..."
pnpm install

echo "4. Building frontend..."
pnpm build

echo "5. Starting Next.js on port 3001..."
PORT=3001 pnpm start > /var/log/minr-frontend.log 2>&1 &

sleep 3

echo "6. Checking if Next.js started..."
if ps aux | grep -q "[n]ext start"; then
    echo "✓ Next.js is running"
else
    echo "✗ Next.js failed to start. Check /var/log/minr-frontend.log"
    tail -20 /var/log/minr-frontend.log
    exit 1
fi

echo "7. Reloading NGINX..."
systemctl reload nginx

echo "=== Done ==="
echo "Frontend should now be working. If issues persist, clear browser cache."

