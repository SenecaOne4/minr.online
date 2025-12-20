# macOS Bundle Implementation Plan

## Overview
Create a self-contained macOS bundle that runs the miner in native mode with no system dependencies.

## File Structure Created

```
release/macos/
├── PLAN.md                          # High-level plan
├── IMPLEMENTATION_PLAN.md           # This file
├── README.md                        # Build instructions
├── build.sh                         # Main build script
├── build-universal2-native.sh       # Native extension builder
└── dist/                            # Output directory (created by build)
    └── minr-online-macos.zip        # Final bundle (~70-100MB)
```

## Build Commands

### Local Build (on macOS)

```bash
cd /Users/seneca/Desktop/minr.online/release/macos
./build.sh
```

**Output:** `dist/minr-online-macos.zip`

### What Build Script Does

1. **Builds universal2 native extension**
   - Compiles `minr_native` for arm64 and x86_64
   - Uses `lipo` to create universal binary
   - Output: `build/native_ext/minr_native.so`

2. **Prepares miner script**
   - Copies `minr-stratum-miner.py`
   - Forces `USE_NATIVE = True`
   - Adds environment variable support
   - Adds startup self-test

3. **Creates launcher**
   - Fetches config from `/api/miner-config`
   - Sets environment variables
   - Launches miner

4. **Builds PyInstaller bundle**
   - Bundles Python 3.11+ runtime
   - Includes native extension
   - Creates `.app` bundle

5. **Packages zip**
   - Includes `.app` + README
   - Ready for distribution

## Code Changes Required

### 1. Miner Script Modifications

**File:** `miner-scripts/minr-stratum-miner.py`

**Changes:**
- Add environment variable support (before `main()`):
  ```python
  # Packaged build: Support environment variables for config
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

- Add startup self-test (before `main()` call):
  ```python
  if __name__ == "__main__":
      # Packaged build: self-test at startup
      print("=" * 60)
      print("Minr.online CPU Miner - macOS Bundle")
      print("=" * 60)
      
      # Check native backend
      if USE_NATIVE:
          if _check_native_module():
              print("✓ Native backend: ENABLED (minr_native.scan_nonces)")
              backend_name = "native"
          else:
              print("✗ ERROR: Native backend required but not available")
              print("  This bundle requires minr_native extension.")
              print("  Please download a fresh bundle or contact support.")
              sys.exit(1)
      else:
          backend_name, _ = _select_sha256_backend()
          print(f"⚠ Backend: {backend_name} (native mode disabled)")
      
      print("=" * 60)
      print()
      
      main()
  ```

**Note:** Build script handles these modifications automatically via `sed`.

### 2. Backend Route Changes

**File:** `backend/src/routes/cpu-miner-launcher.ts`

**Add new endpoint for macOS bundle:**

```typescript
// GET /api/cpu-miner-launcher/macos-bundle - Serve pre-built macOS bundle
router.get('/macos-bundle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check access (same as HTML launcher)
    // ... (profile checks) ...
    
    // Get auth token
    const authHeader = req.headers.authorization;
    const authToken = authHeader?.toString().replace('Bearer ', '') || '';
    
    // Path to pre-built bundle
    const bundlePath = '/var/www/minr-online/release/macos-bundle.zip';
    
    // Check if bundle exists
    if (!fs.existsSync(bundlePath)) {
      return res.status(503).json({ error: 'macOS bundle not available' });
    }
    
    // Read bundle
    const bundleData = fs.readFileSync(bundlePath);
    
    // Send as download
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

**Modify HTML launcher to detect macOS and download zip:**

In `generateLauncherHTML()`, add macOS detection:
```javascript
// Detect macOS
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

if (isMac) {
  // Show macOS bundle download button
  // Download from /api/cpu-miner-launcher/macos-bundle
} else {
  // Show HTML launcher (existing flow)
}
```

### 3. Server Deployment

**Steps:**

1. **Build bundle locally:**
   ```bash
   cd release/macos
   ./build.sh
   ```

2. **Upload to server:**
   ```bash
   scp dist/minr-online-macos.zip root@minr.online:/var/www/minr-online/release/
   ```

3. **Update backend:**
   - Add macOS bundle endpoint (see above)
   - Rebuild and restart backend

4. **Update HTML launcher:**
   - Detect macOS platform
   - Serve zip download instead of HTML

## User Flow

### Current (Broken)
1. Download HTML → Open HTML → Download scripts → Run scripts → Install Python → Install deps → Run miner
2. Uses system Python → Slow (~10^5 H/s)

### New (Fixed)
1. Download zip → Unzip → Double-click `.app` → Mines fast (~10^7+ H/s)
2. Self-contained → Native mode → No dependencies

## Testing Checklist

- [ ] Bundle builds successfully
- [ ] Native extension loads correctly
- [ ] Startup self-test prints correct backend
- [ ] Config fetch works from API
- [ ] Miner starts and connects to pool
- [ ] Hashrate matches native bench (~10^7+ H/s per worker)
- [ ] Double-click launch works
- [ ] No system Python required
- [ ] Works on both Apple Silicon and Intel Macs

## Fixes for Known Issues

### Issue: User typed `+x` instead of `chmod +x`
**Fix:** Bundle is a `.app` - no manual chmod needed. Double-click works.

### Issue: Slow hashrate (~10^5 H/s)
**Fix:** Bundle forces native mode, includes compiled extension, no fallback.

### Issue: Multiprocessing pickling errors
**Fix:** Already fixed with `mp.set_start_method("fork")` at top of script.

## Next Steps

1. **Test build locally**
2. **Fix any build script issues**
3. **Add backend endpoint**
4. **Update HTML launcher**
5. **Deploy to server**
6. **Test end-to-end**

