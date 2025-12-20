#!/bin/bash
set -e

# Minr.online macOS Bundle Builder
# Produces: minr-online-macos.zip (self-contained, native mode)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
DIST_DIR="$SCRIPT_DIR/dist"
ZIP_NAME="minr-online-macos.zip"

echo "=========================================="
echo "Minr.online macOS Bundle Builder"
echo "=========================================="

# Clean previous builds
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Check dependencies
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 not found"
    exit 1
fi

if ! command -v pip3 &> /dev/null; then
    echo "ERROR: pip3 not found"
    exit 1
fi

# Install PyInstaller if needed
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    echo "Installing PyInstaller..."
    pip3 install pyinstaller
fi

# Step 1: Build universal2 native extension
echo ""
echo "Step 1: Building universal2 native extension..."
"$SCRIPT_DIR/build-universal2-native.sh" || {
    echo "ERROR: Failed to build native extension"
    exit 1
}

# Step 2: Copy miner script
echo ""
echo "Step 2: Preparing miner script..."
MINER_SOURCE="$PROJECT_ROOT/miner-scripts/minr-stratum-miner.py"
MINER_BUILD="$BUILD_DIR/minr-stratum-miner.py"

if [ ! -f "$MINER_SOURCE" ]; then
    echo "ERROR: Miner script not found: $MINER_SOURCE"
    exit 1
fi

cp "$MINER_SOURCE" "$MINER_BUILD"

# Step 3: Copy bundled miner launcher
echo ""
echo "Step 3: Preparing bundled miner launcher..."
BUNDLED_MINER="$SCRIPT_DIR/bundled-miner.py"
if [ ! -f "$BUNDLED_MINER" ]; then
    echo "ERROR: Bundled miner not found: $BUNDLED_MINER"
    exit 1
fi

# Step 4: Build with PyInstaller
echo ""
echo "Step 4: Building with PyInstaller..."

# Create PyInstaller spec
SPEC_FILE="$BUILD_DIR/minr-online.spec"
python3 << SPEC_SCRIPT > "$SPEC_FILE"
import os

build_dir = r'$BUILD_DIR'
bundled_miner = r'$BUNDLED_MINER'
miner_build = r'$MINER_BUILD'
native_ext = os.path.join(build_dir, 'native_ext', 'minr_native.so')

spec_content = f'''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    [r'{bundled_miner}'],
    pathex=[r'{build_dir}'],
    binaries=[
        (r'{native_ext}', '.'),
    ],
    datas=[
        (r'{miner_build}', '.'),
    ],
    hiddenimports=['minr_native'],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='minr-online',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_trace=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='minr-online',
)

app = BUNDLE(
    coll,
    name='Minr.online.app',
    icon=None,
    bundle_identifier='online.minr.miner',
    version='1.0.0',
    info_plist={{
        'NSPrincipalClass': 'NSApplication',
        'NSHighResolutionCapable': 'True',
        'LSMinimumSystemVersion': '10.13',
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleVersion': '1.0.0',
    }},
)
'''

print(spec_content)
SPEC_SCRIPT

# Run PyInstaller
cd "$BUILD_DIR"
pyinstaller --clean --noconfirm "$SPEC_FILE" || {
    echo "ERROR: PyInstaller build failed"
    exit 1
}

# Step 5: Create final bundle
echo ""
echo "Step 5: Creating final bundle..."
APP_BUNDLE="$BUILD_DIR/dist/Minr.online.app"
if [ ! -d "$APP_BUNDLE" ]; then
    echo "ERROR: App bundle not found: $APP_BUNDLE"
    exit 1
fi

# Step 6: Create README
README="$DIST_DIR/README.txt"
cat > "$README" << README_EOF
Minr.online CPU Miner - macOS Bundle
=====================================

INSTALLATION:
1. Unzip this file
2. Double-click "Minr.online.app"
3. Mining starts automatically!

REQUIREMENTS:
- macOS 10.13 or later
- Internet connection
- Auth token (embedded in download)

PERFORMANCE:
- Uses native C extension for maximum speed (~10^7+ H/s)
- Default: Uses all CPU cores (capped at 10)
- Override threads: MINR_THREADS=4 open Minr.online.app

ENVIRONMENT VARIABLES (optional):
- MINR_AUTH_TOKEN: Auth token (if not embedded)
- MINR_WALLET: BTC wallet address
- MINR_WORKER: Worker name
- MINR_HOST: Stratum host
- MINR_PORT: Stratum port
- MINR_THREADS: Number of threads (default: CPU count, max 10)

TROUBLESHOOTING:
- If macOS blocks it: Right-click → Open (first time only)
- If native backend fails: Download a fresh bundle
- If authentication fails: Download a new bundle from minr.online/miners

SUPPORT:
Visit https://minr.online for help
README_EOF

# Step 7: Package zip
echo ""
echo "Step 6: Packaging zip..."
cd "$DIST_DIR"
cp -r "$APP_BUNDLE" .
zip -r "$ZIP_NAME" "Minr.online.app" README.txt || {
    echo "ERROR: Failed to create zip"
    exit 1
}

echo ""
echo "=========================================="
echo "✓ Build complete!"
echo "=========================================="
echo "Output: $DIST_DIR/$ZIP_NAME"
echo "Size: $(du -h "$DIST_DIR/$ZIP_NAME" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Test: cd dist && unzip $ZIP_NAME && open Minr.online.app"
echo "2. Upload: scp dist/$ZIP_NAME root@minr.online:/var/www/minr-online/frontend/public/downloads/"
echo "3. Verify: https://minr.online/downloads/$ZIP_NAME"
echo ""
