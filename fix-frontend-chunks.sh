#!/bin/bash
# Fix frontend chunk loading errors by doing a clean rebuild and restart

set -e

cd /var/www/minr-online/frontend

echo "=== Fixing Frontend Chunk Loading Errors ==="
echo ""

# 1. Kill all Next.js processes
echo "1. Killing existing Next.js processes..."
pkill -9 -f 'next start' || true
pkill -9 -f 'node.*next' || true
sleep 2

# 2. Remove old build
echo "2. Removing old .next directory..."
rm -rf .next

# 3. Clean install (optional, but ensures clean state)
echo "3. Installing dependencies..."
pnpm install --frozen-lockfile

# 4. Build
echo "4. Building frontend..."
pnpm build

# 5. Verify build
echo "5. Verifying build..."
if [ ! -d ".next" ]; then
    echo "ERROR: Build failed - .next directory not found"
    exit 1
fi

# 6. Start Next.js
echo "6. Starting Next.js on port 3001..."
PORT=3001 pnpm start > /var/log/minr-frontend.log 2>&1 &
sleep 3

# 7. Verify it's running
if ps aux | grep -q '[n]ext start'; then
    echo "✓ Next.js is running"
else
    echo "ERROR: Next.js failed to start"
    tail -20 /var/log/minr-frontend.log
    exit 1
fi

# 8. Test health endpoint
echo "7. Testing frontend..."
if curl -s http://127.0.0.1:3001 > /dev/null; then
    echo "✓ Frontend is responding"
else
    echo "ERROR: Frontend not responding"
    exit 1
fi

# 9. Reload NGINX
echo "8. Reloading NGINX..."
nginx -t && systemctl reload nginx
echo "✓ NGINX reloaded"

echo ""
echo "=== Frontend Fix Complete ==="
echo "Frontend should now be serving the latest chunks correctly."
