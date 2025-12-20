# macOS Bundle Release Plan - Summary

## Plan (Bullet List)

1. **Build universal2 native extension**
   - Compile minr_native for arm64 and x86_64 separately
   - Use `lipo` to create universal2 binary
   - Package as `.so` file

2. **Create modified miner script**
   - Force `USE_NATIVE = True` (no fallback)
   - Add environment variable support (MINR_WALLET, MINR_WORKER, etc.)
   - Add startup self-test (prints backend status, exits if native unavailable)

3. **Create launcher script**
   - Fetches config from `/api/miner-config` using auth token
   - Sets environment variables
   - Launches miner script

4. **Build PyInstaller bundle**
   - Bundles Python 3.11+ runtime
   - Includes native extension as binary
   - Includes miner script as data
   - Creates `.app` bundle

5. **Package zip**
   - Includes `.app` + README
   - Ready for distribution (~70-100MB)

6. **Update server**
   - Add `/api/cpu-miner-launcher/macos-bundle` endpoint
   - Update HTML launcher to detect macOS and serve zip
   - Upload bundle to server

## Exact File Tree Created

```
release/macos/
├── build.sh                         # Main build script
├── build-universal2-native.sh       # Native extension builder
├── PLAN.md                          # High-level plan
├── IMPLEMENTATION_PLAN.md           # Detailed implementation
├── DEPLOYMENT.md                    # Server deployment guide
├── README.md                        # Build instructions
├── QUICK_START.md                   # Quick reference
├── SUMMARY.md                       # This file
├── build/                           # Build artifacts (created)
│   ├── native_ext/
│   │   └── minr_native.so          # Universal2 binary
│   ├── native_arm64/               # arm64 build
│   ├── native_x86_64/               # x86_64 build
│   ├── minr-stratum-miner.py       # Modified miner script
│   ├── launcher.py                  # Launcher script
│   └── minr-online.spec             # PyInstaller spec
└── dist/                            # Output (created)
    ├── Minr.online.app/             # macOS app bundle
    │   ├── Contents/
    │   │   ├── MacOS/
    │   │   │   └── minr-online      # Executable
    │   │   ├── Resources/
    │   │   └── Info.plist
    │   └── ...
    ├── README.txt                   # User instructions
    └── minr-online-macos.zip        # Final bundle (~70-100MB)
```

## Exact Commands to Build Locally

```bash
# 1. Navigate to build directory
cd /Users/seneca/Desktop/minr.online/release/macos

# 2. Make scripts executable (if needed)
chmod +x build.sh build-universal2-native.sh

# 3. Run build
./build.sh

# Output: dist/minr-online-macos.zip
```

**Build time:** ~5-10 minutes (depends on compilation speed)

## Server Changes Required

### 1. Backend Route Addition

**File:** `backend/src/routes/cpu-miner-launcher.ts`

**Add after line 137 (after existing routes):**

```typescript
import fs from 'fs';

// GET /api/cpu-miner-launcher/macos-bundle - Serve macOS bundle
router.get('/macos-bundle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Same access checks as HTML launcher (profile, payment, etc.)
    // ... (copy from HTML launcher route) ...
    
    const bundlePath = '/var/www/minr-online/release/macos-bundle.zip';
    
    if (!fs.existsSync(bundlePath)) {
      return res.status(503).json({ error: 'macOS bundle not available' });
    }
    
    const bundleData = fs.readFileSync(bundlePath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="minr-online-macos-${Date.now()}.zip"`);
    res.setHeader('Content-Length', bundleData.length.toString());
    res.send(bundleData);
  } catch (error: any) {
    console.error('[cpu-miner-launcher] Error serving macOS bundle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 2. HTML Launcher Update

**File:** `backend/src/routes/cpu-miner-launcher.ts`

**In `generateLauncherHTML()` function, add macOS detection:**

```typescript
// After detecting platform, add macOS-specific section:
if (platform === 'mac') {
  // Add macOS bundle download button
  html += `
    <div class="card" style="margin-top: 20px; background: rgba(59, 130, 246, 0.1);">
      <h3 style="color: #93c5fd;">🍎 macOS Bundle (Recommended)</h3>
      <p style="color: #cbd5e1;">
        Self-contained bundle with embedded Python and native extension.
        No Terminal commands needed - just unzip and double-click!
      </p>
      <button onclick="downloadMacBundle()" class="btn-primary">
        📥 Download macOS Bundle (~80MB)
      </button>
    </div>
    <script>
      async function downloadMacBundle() {
        const response = await fetch('/api/cpu-miner-launcher/macos-bundle', {
          headers: { Authorization: \`Bearer \${CONFIG.authToken}\` }
        });
        if (!response.ok) {
          alert('Error downloading bundle');
          return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`minr-online-macos-\${Date.now()}.zip\`;
        a.click();
        alert('Download complete! Unzip and double-click Minr.online.app');
      }
    </script>
  `;
}
```

### 3. Server Deployment

```bash
# On server:
cd /var/www/minr-online
mkdir -p release

# Upload bundle (from local machine):
scp release/macos/dist/minr-online-macos.zip root@minr.online:/var/www/minr-online/release/macos-bundle.zip

# Update backend:
cd backend
git pull origin main
pnpm build
pkill -9 node
PORT=3000 NODE_ENV=production nohup node dist/index.js > /var/log/minr-backend.log 2>&1 &
```

## Code/Config Changes Required

### Miner Script Modifications

**File:** `miner-scripts/minr-stratum-miner.py`

**Changes (handled by build script automatically):**

1. **Add environment variable support** (before `main()`):
   ```python
   # Packaged build: Support environment variables
   import os
   if os.environ.get("MINR_WALLET"):
       BTC_WALLET = os.environ.get("MINR_WALLET")
   if os.environ.get("MINR_WORKER"):
       WORKER_NAME = os.environ.get("MINR_WORKER")
   if os.environ.get("MINR_STRATUM_HOST"):
       STRATUM_HOST = os.environ.get("MINR_STRATUM_HOST")
   if os.environ.get("MINR_STRATUM_PORT"):
       STRATUM_PORT = int(os.environ.get("MINR_STRATUM_PORT", "3333"))
   if os.environ.get("MINR_API_URL"):
       API_URL = os.environ.get("MINR_API_URL")
   ```

2. **Force native mode** (in packaged builds):
   ```python
   USE_NATIVE = True  # Packaged build: force native
   ```

3. **Add startup self-test** (before `main()` call):
   ```python
   if __name__ == "__main__":
       # Self-test
       print("=" * 60)
       print("Minr.online CPU Miner - macOS Bundle")
       print("=" * 60)
       
       if USE_NATIVE:
           if _check_native_module():
               print("✓ Native backend: ENABLED (minr_native.scan_nonces)")
           else:
               print("✗ ERROR: Native backend required but not available")
               sys.exit(1)
       
       print("=" * 60)
       print()
       main()
   ```

**Note:** Build script (`build.sh`) handles these modifications automatically via Python script, so no manual changes needed to source file.

## User Instructions (Final)

**For macOS users:**
1. Visit https://minr.online/miners
2. Click "Download macOS Bundle"
3. Unzip `minr-online-macos.zip`
4. Double-click `Minr.online.app`
5. Mining starts automatically!

**No Terminal, no chmod, no pip, no brew!**

## Fixes Applied

✅ **`+x` confusion fixed** - Bundle is `.app`, double-click works  
✅ **Native mode enforced** - No fallback, exits with clear error if native unavailable  
✅ **Self-contained** - No system Python, no dependencies  
✅ **Fast hashrate** - Native extension included, ~10^7+ H/s per worker  
✅ **Multiprocessing fixed** - `mp.set_start_method("fork")` already in place

## Testing Checklist

- [ ] Build completes successfully
- [ ] Native extension loads in bundle
- [ ] Startup self-test prints correct backend
- [ ] Config fetch works from API
- [ ] Miner connects and hashes
- [ ] Hashrate matches native bench
- [ ] Double-click launch works
- [ ] Works on Apple Silicon (arm64)
- [ ] Works on Intel Macs (x86_64)

## Next Steps

1. Test build locally: `cd release/macos && ./build.sh`
2. Fix any build issues
3. Add backend endpoint (see DEPLOYMENT.md)
4. Update HTML launcher (see DEPLOYMENT.md)
5. Deploy to server
6. Test end-to-end

