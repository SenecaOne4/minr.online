#!/bin/bash
# Frontend Deployment Script
# Run this on the server: bash deploy-frontend.sh

set -e  # Exit on error

echo "=== Frontend Deployment Script ==="
echo ""

# Navigate to frontend directory
cd /var/www/minr-online/frontend || exit 1

echo "1. Checking current state..."
echo "   Current directory: $(pwd)"
echo "   Git status:"
git status --short || echo "   (git status failed)"

echo ""
echo "2. Pulling latest code..."
git pull origin main

echo ""
echo "3. Removing stale build..."
rm -rf .next
echo "   ✓ Removed .next directory"

echo ""
echo "4. Installing dependencies..."
pnpm install

echo ""
echo "5. Building frontend..."
pnpm build

echo ""
echo "6. Verifying build output..."
if [ -d ".next/static/chunks" ]; then
    echo "   ✓ Build successful - chunks directory exists"
    echo "   Chunk files found:"
    ls -1 .next/static/chunks/ | head -5
else
    echo "   ✗ ERROR: Build failed - no chunks directory"
    exit 1
fi

echo ""
echo "7. Checking if frontend service exists..."
if systemctl list-unit-files | grep -q "frontend.service"; then
    echo "   ✓ Frontend service found"
    echo "   Restarting frontend service..."
    systemctl restart frontend
    sleep 2
    systemctl status frontend --no-pager | head -10
else
    echo "   ⚠ Frontend service not found - checking for manual process..."
    if pgrep -f "next start" > /dev/null; then
        echo "   Found Next.js process - you may need to restart it manually"
        ps aux | grep "next start" | grep -v grep
    else
        echo "   No Next.js process found - starting manually..."
        echo "   Run: cd /var/www/minr-online/frontend && PORT=3001 pnpm start &"
    fi
fi

echo ""
echo "8. Checking NGINX configuration..."
if [ -f "/etc/nginx/sites-available/minr.online" ]; then
    echo "   ✓ NGINX config found"
    echo "   Reloading NGINX..."
    nginx -t && systemctl reload nginx
    echo "   ✓ NGINX reloaded"
else
    echo "   ⚠ NGINX config not found at /etc/nginx/sites-available/minr.online"
fi

echo ""
echo "9. Verifying Next.js is listening on port 3001..."
if ss -tulpn | grep -q ":3001"; then
    echo "   ✓ Port 3001 is in use (Next.js should be running)"
else
    echo "   ⚠ Port 3001 is not in use - Next.js may not be running"
fi

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo "2. Check browser console for chunk errors"
echo "3. Verify chunks load successfully in Network tab"

