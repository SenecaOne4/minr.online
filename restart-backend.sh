#!/bin/bash
# Quick script to restart backend and check logs

cd /var/www/minr-online/backend

echo "Stopping existing backend..."
pkill -f 'node.*dist/index.js' || true
sleep 2

echo "Starting backend..."
nohup node dist/index.js > /tmp/backend.log 2>&1 &
sleep 3

echo "=== Backend Log (last 20 lines) ==="
tail -20 /tmp/backend.log

echo ""
echo "=== Checking if Supabase loaded ==="
if grep -q "Client initialized" /tmp/backend.log; then
  echo "✅ Supabase client initialized successfully!"
else
  echo "❌ Supabase client NOT initialized - check .env file"
fi

echo ""
echo "=== Testing health endpoint ==="
curl -s http://localhost:3000/health || echo "Health check failed"

