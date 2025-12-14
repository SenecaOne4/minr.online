#!/bin/bash
# Script to fix Next.js frontend server on production
# Run this on the server: bash fix-frontend-server.sh

set -e

echo "=== Fixing Next.js Frontend Server ==="
echo ""

cd /var/www/minr-online/frontend

echo "1. Pulling latest code..."
git pull origin main

echo ""
echo "2. Checking environment variables..."
if [ ! -f ".env.local" ]; then
    echo "   Creating .env.local from template..."
    cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://byeokczfgepuecugaikj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZW9rY3pmZ2VwdWVjdWdhaWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODE3ODQsImV4cCI6MjA4MTA1Nzc4NH0.DYDTE4eH5aYec9ylMyIWYjXl5qgKKDwuz9rC23jyWS4
NEXT_PUBLIC_SITE_URL=https://minr.online
NEXT_PUBLIC_API_URL=https://api.minr.online
NEXT_PUBLIC_WS_URL=wss://ws.minr.online/ws/stratum-browser
NODE_ENV=production
PORT=3001
EOF
    echo "   ✓ Created .env.local"
else
    echo "   ✓ .env.local already exists"
fi

echo ""
echo "3. Stopping any existing Next.js processes..."
pkill -f "next start" || echo "   No existing Next.js processes found"

echo ""
echo "4. Removing stale build..."
rm -rf .next
echo "   ✓ Removed .next directory"

echo ""
echo "5. Installing dependencies..."
pnpm install

echo ""
echo "6. Building frontend..."
pnpm build

echo ""
echo "7. Verifying build output..."
if [ -d ".next/static/chunks" ]; then
    echo "   ✓ Build successful - chunks directory exists"
    echo "   Chunk files found:"
    ls -1 .next/static/chunks/ | head -5
else
    echo "   ✗ ERROR: Build failed - no chunks directory"
    exit 1
fi

echo ""
echo "8. Starting Next.js server on port 3001..."
PORT=3001 pnpm start > /var/log/minr-frontend.log 2>&1 &
NEXT_PID=$!
echo "   ✓ Started Next.js (PID: $NEXT_PID)"

echo ""
echo "9. Waiting for server to start..."
sleep 5

echo ""
echo "10. Checking if server is responding..."
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/ | grep -q "200\|301\|302"; then
    echo "   ✓ Server is responding on port 3001"
else
    echo "   ⚠ Server may not be responding yet - check logs: tail -f /var/log/minr-frontend.log"
fi

echo ""
echo "11. Checking NGINX configuration..."
if [ -f "/etc/nginx/sites-available/minr.online" ]; then
    echo "   ✓ NGINX config found"
    echo "   Testing NGINX config..."
    nginx -t && echo "   ✓ NGINX config is valid"
    echo "   Reloading NGINX..."
    systemctl reload nginx
    echo "   ✓ NGINX reloaded"
else
    echo "   ⚠ NGINX config not found - updating it..."
    cp /var/www/minr-online/infra/nginx.conf /etc/nginx/sites-available/minr.online
    ln -sf /etc/nginx/sites-available/minr.online /etc/nginx/sites-enabled/minr.online
    nginx -t && systemctl reload nginx
fi

echo ""
echo "12. Setting up systemd service..."
cp /var/www/minr-online/infra/systemd/frontend.service /etc/systemd/system/frontend.service

# Create environment file for systemd
cat > /etc/minr-frontend.env << EOF
NEXT_PUBLIC_SUPABASE_URL=https://byeokczfgepuecugaikj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZW9rY3pmZ2VwdWVjdWdhaWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODE3ODQsImV4cCI6MjA4MTA1Nzc4NH0.DYDTE4eH5aYec9ylMyIWYjXl5qgKKDwuz9rC23jyWS4
NEXT_PUBLIC_SITE_URL=https://minr.online
NEXT_PUBLIC_API_URL=https://api.minr.online
NEXT_PUBLIC_WS_URL=wss://ws.minr.online/ws/stratum-browser
NODE_ENV=production
PORT=3001
EOF

systemctl daemon-reload
systemctl enable frontend
systemctl restart frontend || echo "   ⚠ Service restart failed - may need to start manually"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next.js should now be running on port 3001"
echo "Check status with: systemctl status frontend"
echo "View logs with: journalctl -u frontend -f"
echo "Or check process: ps aux | grep 'next start'"
echo ""
echo "Test the server:"
echo "  curl -I http://127.0.0.1:3001/"
echo "  curl -I http://127.0.0.1:3001/_next/static/chunks/webpack-*.js | head -1"

