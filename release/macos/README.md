# macOS Bundle Build Instructions

## Quick Start

```bash
cd release/macos
./build.sh
```

**Output:** `dist/minr-online-macos.zip` (~70-100MB)

## What It Builds

- **Minr.online.app** - Double-clickable macOS app bundle
- **Embedded Python** - Self-contained Python 3.11+ runtime
- **Native Extension** - minr_native compiled for universal2 (arm64 + x86_64)
- **Bundled Miner** - Launcher that fetches config and runs miner in native mode
- **Self-Test** - 3-second benchmark on startup to verify native backend

## Requirements

- macOS 10.13+ (for building)
- Python 3.11+ with pip
- Homebrew (for OpenSSL)
- PyInstaller (`pip3 install pyinstaller`)

## Build Process

1. **Build universal2 native extension**
   - Compiles minr_native for both arm64 and x86_64
   - Uses `lipo` to create universal binary

2. **Prepare bundled miner**
   - Uses `bundled-miner.py` as entry point
   - Fetches config from API
   - Runs 3-second self-test
   - Forces native mode (no fallback)

3. **Build PyInstaller bundle**
   - Bundles Python runtime
   - Includes native extension
   - Includes miner script as data
   - Creates .app bundle

4. **Package zip**
   - Includes .app + README
   - Ready for distribution

## Testing

```bash
# Build
./build.sh

# Test locally
cd dist
unzip minr-online-macos.zip
export MINR_AUTH_TOKEN="your-test-token"
open Minr.online.app
```

## Deployment

1. **Build bundle locally:**
   ```bash
   cd release/macos
   ./build.sh
   ```

2. **Upload to server:**
   ```bash
   scp dist/minr-online-macos.zip root@minr.online:/var/www/minr-online/frontend/public/downloads/
   ```

3. **Verify:**
   ```bash
   # On server
   ls -lh /var/www/minr-online/frontend/public/downloads/minr-online-macos.zip
   ```

4. **Access URL:**
   ```
   https://minr.online/downloads/minr-online-macos.zip
   ```

## Features

- **Forced Native Mode**: No fallback to hashlib, exits with clear error if native unavailable
- **Self-Test**: 3-second benchmark on startup, must achieve > 1M H/s
- **Config Fetching**: Fetches from `/api/miner-config` using auth token
- **Environment Overrides**: Supports MINR_WALLET, MINR_WORKER, MINR_THREADS, etc.
- **Thread Defaults**: Uses CPU count (capped at 10) unless overridden

## Troubleshooting

- **"Native backend not available"**: Rebuild the bundle
- **"Self-test failed"**: Native extension not loading correctly
- **Gatekeeper issues**: Right-click → Open (first time only)
- **Authentication failed**: Download fresh bundle from website
