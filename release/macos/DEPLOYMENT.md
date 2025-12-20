# macOS Bundle Deployment Guide

## Server Changes Required

### 1. Add macOS Bundle Endpoint

**File:** `backend/src/routes/cpu-miner-launcher.ts`

Add after the existing routes:

```typescript
import fs from 'fs';
import path from 'path';

// GET /api/cpu-miner-launcher/macos-bundle - Serve pre-built macOS bundle with embedded auth token
router.get('/macos-bundle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const userEmail = req.user!.email || '';

    // Check access (same as HTML launcher)
    let { data: profile, error: profileError } = await supabase!
      .from('profiles')
      .select('id, has_paid_entry_fee, exempt_from_entry_fee, is_admin, btc_payout_address')
      .eq('id', userId)
      .single();

    if (!profile || profileError) {
      // Auto-create profile (same logic as HTML launcher)
      const { data: newProfile } = await supabase!
        .from('profiles')
        .upsert({ id: userId, username: null, btc_payout_address: null }, { onConflict: 'id' })
        .select('id, has_paid_entry_fee, exempt_from_entry_fee, is_admin, btc_payout_address')
        .single();
      profile = newProfile;
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'senecaone4@gmail.com';
    const isAdmin = userEmail === ADMIN_EMAIL || profile?.is_admin === true;

    if (!profile?.has_paid_entry_fee && !profile?.exempt_from_entry_fee && !isAdmin) {
      return res.status(403).json({ error: 'Entry fee payment required' });
    }

    if (!profile?.btc_payout_address) {
      return res.status(400).json({ error: 'BTC payout address not set' });
    }

    // Get auth token
    const authHeader = req.headers.authorization;
    const authToken = authHeader?.toString().replace('Bearer ', '') || '';

    // Path to pre-built bundle
    const bundlePath = '/var/www/minr-online/release/macos-bundle.zip';

    if (!fs.existsSync(bundlePath)) {
      console.error('[cpu-miner-launcher] macOS bundle not found at:', bundlePath);
      return res.status(503).json({ error: 'macOS bundle not available. Please contact support.' });
    }

    // For now, serve the generic bundle
    // TODO: In future, we can inject auth token into bundle here
    const bundleData = fs.readFileSync(bundlePath);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="minr-online-macos-${Date.now()}.zip"`);
    res.setHeader('Content-Length', bundleData.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(bundleData);
  } catch (error: any) {
    console.error('[cpu-miner-launcher] Error serving macOS bundle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 2. Update HTML Launcher to Detect macOS

**File:** `backend/src/routes/cpu-miner-launcher.ts`

In `generateLauncherHTML()`, modify the button section:

```typescript
// Detect macOS and show bundle download
const isMac = platform === 'mac';

if (isMac) {
  // Show macOS bundle download button
  html += `
    <div class="card" style="margin-top: 20px;">
      <h3 style="color: #93c5fd; margin-bottom: 10px;">🍎 macOS Bundle (Recommended)</h3>
      <p style="color: #cbd5e1; margin-bottom: 15px;">
        Self-contained bundle with embedded Python and native extension.
        No dependencies required - just unzip and double-click!
      </p>
      <button onclick="downloadMacBundle()" class="btn-primary">
        📥 Download macOS Bundle (~80MB)
      </button>
    </div>
  `;
  
  // Add download function
  html += `
    <script>
      async function downloadMacBundle() {
        try {
          const response = await fetch('/api/cpu-miner-launcher/macos-bundle', {
            headers: { Authorization: \`Bearer \${CONFIG.authToken}\` }
          });
          if (!response.ok) {
            const error = await response.json();
            alert(\`Error: \${error.error}\`);
            return;
          }
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = \`minr-online-macos-\${Date.now()}.zip\`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          alert('Download complete! Unzip and double-click Minr.online.app');
        } catch (error) {
          alert(\`Error: \${error.message}\`);
        }
      }
    </script>
  `;
} else {
  // Show existing HTML launcher for other platforms
  // ... existing code ...
}
```

### 3. Server Deployment Steps

```bash
# 1. Build bundle locally
cd release/macos
./build.sh

# 2. Upload to server
scp dist/minr-online-macos.zip root@minr.online:/var/www/minr-online/release/

# 3. On server: Update backend
cd /var/www/minr-online
git pull origin main
cd backend
pnpm build
pkill -9 node
PORT=3000 NODE_ENV=production nohup node dist/index.js > /var/log/minr-backend.log 2>&1 &
```

## Testing

1. **Build locally:**
   ```bash
   cd release/macos
   ./build.sh
   ```

2. **Test bundle:**
   ```bash
   cd dist
   unzip minr-online-macos.zip
   # Set auth token (for testing)
   export MINR_AUTH_TOKEN="your-test-token"
   open Minr.online.app
   ```

3. **Verify:**
   - Native backend loads
   - Config fetches from API
   - Miner connects and hashes
   - Hashrate matches native bench

## User Instructions (Final)

**For macOS users:**
1. Download `minr-online-macos.zip` from minr.online/miners
2. Unzip the file
3. Double-click `Minr.online.app`
4. Mining starts automatically!

**No Terminal commands needed!**

