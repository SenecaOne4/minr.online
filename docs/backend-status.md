# Backend Status

## ✅ Currently Working

The backend is running and responding correctly. The following routes are available:

- `GET /health` - Health check endpoint
- `GET /api/version` - Returns git commit hash and timestamp
- `GET /api/profile` - Get user profile (requires auth)
- `POST /api/profile` - Update user profile (requires auth)
- `GET /api/membership` - Get user membership (requires auth)
- `WS /ws/stratum-browser` - WebSocket Stratum bridge

## ⚠️ Expected "Not Available" Messages

When the backend starts, you may see these messages:

```
[server] Payment routes not available
[server] Admin routes not available
[server] Analytics routes not available
[server] Miner download routes not available
[server] Payment verifier service not available
[server] Pool stats service not available
```

**These are normal and expected!** These features are planned but not yet implemented. The backend will work fine without them.

## 🔍 How to Verify Backend is Running

1. **Check if process is running:**
   ```bash
   ps aux | grep 'node.*dist/index.js'
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"ok":true}
   ```

3. **Check backend logs:**
   ```bash
   tail -f /tmp/backend.log
   ```

4. **Verify Supabase is loaded:**
   ```bash
   grep "Client initialized" /tmp/backend.log
   # Should show: [supabase] Client initialized
   ```

## 🚀 Restart Backend

If you need to restart the backend:

```bash
cd /var/www/minr-online/backend
pkill -f 'node.*dist/index.js'
node dist/index.js
```

Or use the restart script:
```bash
cd /var/www/minr-online
./restart-backend.sh
```

