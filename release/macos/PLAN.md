# macOS Bundle Release Plan

## Goal
Self-contained macOS bundle: download → unzip → double-click → mines fast (native mode)

## Architecture

### Approach: PyInstaller + Universal2 Native Extension
- PyInstaller bundles Python runtime + dependencies
- Native extension compiled as universal2 (arm64 + x86_64)
- .app bundle for double-click launch
- Total size: ~70-100MB

## File Structure

```
release/macos/
├── build.sh                    # Main build script
├── build-universal2-native.sh  # Build native extension for universal2
├── launcher.py                 # Wrapper that fetches config and launches miner
├── miner-wrapper.py            # Modified miner with native-first defaults
├── Info.plist                  # macOS app metadata
├── icon.icns                   # App icon (optional)
└── README.md                   # Build instructions
```

## Build Process

1. **Compile native extension (universal2)**
   - Build for arm64 and x86_64 separately
   - Use `lipo` to create universal2 binary
   - Package as .so file

2. **Create PyInstaller spec**
   - Bundle Python 3.11+ runtime
   - Include native extension
   - Create .app bundle structure

3. **Build launcher**
   - Fetches config from API on startup
   - Launches miner with config
   - Shows console output

4. **Package zip**
   - Bundle .app + README
   - Create minr-online-macos.zip

## Code Changes Required

### miner-scripts/minr-stratum-miner.py
- Change `USE_NATIVE = False` → `USE_NATIVE = True` (for packaged builds)
- Add startup self-test: print backend status
- Exit with clear error if native not available (no silent fallback)

### backend/src/routes/cpu-miner-launcher.ts
- Detect macOS platform
- Serve zip file instead of HTML for macOS
- Update download button text

### Server
- Store zip file in accessible location
- Serve via /api/cpu-miner-launcher/macos-bundle endpoint

## Build Commands

```bash
cd release/macos
./build.sh
# Produces: minr-online-macos.zip
```

## Deployment

1. Build zip locally
2. Upload to server: `/var/www/minr-online/release/macos-bundle.zip`
3. Update backend route to serve zip
4. Update HTML launcher to detect macOS and download zip

