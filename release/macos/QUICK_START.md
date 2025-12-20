# Quick Start - macOS Bundle

## Build Commands

```bash
cd /Users/seneca/Desktop/minr.online/release/macos
./build.sh
```

**Output:** `dist/minr-online-macos.zip` (~70-100MB)

## What Gets Built

- `Minr.online.app` - Double-clickable macOS app
- Embedded Python 3.11+ runtime
- Native extension (minr_native) compiled for universal2
- Miner script with native mode forced
- Launcher that fetches config from API

## File Tree Created

```
release/macos/
├── build.sh                    # Main build script
├── build-universal2-native.sh # Native extension builder
├── PLAN.md                     # High-level plan
├── IMPLEMENTATION_PLAN.md      # Detailed implementation
├── DEPLOYMENT.md               # Server deployment guide
├── README.md                   # Build instructions
└── dist/                       # Output (created by build)
    └── minr-online-macos.zip   # Final bundle
```

## Server Changes

1. **Add endpoint:** `/api/cpu-miner-launcher/macos-bundle`
2. **Update HTML:** Detect macOS, show zip download
3. **Upload bundle:** `/var/www/minr-online/release/macos-bundle.zip`

See `DEPLOYMENT.md` for exact code changes.

## Code Modifications

### Miner Script
- Forces `USE_NATIVE = True` (build script handles this)
- Adds environment variable support
- Adds startup self-test

### Backend Route
- New endpoint serves zip file
- Checks auth and access (same as HTML launcher)

### HTML Launcher
- Detects macOS platform
- Shows zip download button instead of HTML

## Testing

```bash
# Build
./build.sh

# Test locally
cd dist
unzip minr-online-macos.zip
export MINR_AUTH_TOKEN="test-token"
open Minr.online.app
```

## Fixes

✅ **No more `+x` confusion** - Bundle is `.app`, double-click works  
✅ **Native mode enforced** - No fallback, exits if native unavailable  
✅ **Self-contained** - No system Python, no pip, no brew  
✅ **Fast hashrate** - Native extension included, ~10^7+ H/s per worker
