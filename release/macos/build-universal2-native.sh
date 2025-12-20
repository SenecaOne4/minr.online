#!/bin/bash
set -e

# Build minr_native extension for universal2 (arm64 + x86_64)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
NATIVE_DIR="$BUILD_DIR/native_ext"

echo "Building universal2 native extension..."

# Find minr_native.c source
NATIVE_C_FILE=""
for path in "$PROJECT_ROOT/miner-scripts/minr_native.c" "$HOME/.minr-online/minr_native.c" "$PROJECT_ROOT/minr_native.c"; do
    if [ -f "$path" ]; then
        NATIVE_C_FILE="$path"
        break
    fi
done

if [ -z "$NATIVE_C_FILE" ]; then
    echo "ERROR: minr_native.c not found"
    echo "Searched:"
    echo "  $PROJECT_ROOT/miner-scripts/minr_native.c"
    echo "  $HOME/.minr-online/minr_native.c"
    echo "  $PROJECT_ROOT/minr_native.c"
    exit 1
fi

echo "Found minr_native.c at: $NATIVE_C_FILE"
mkdir -p "$NATIVE_DIR"

# Check for OpenSSL
if ! command -v openssl &> /dev/null; then
    echo "ERROR: OpenSSL not found. Install with: brew install openssl"
    exit 1
fi

# Find OpenSSL
OPENSSL_PREFIX=$(brew --prefix openssl@3 2>/dev/null || brew --prefix openssl 2>/dev/null || echo "/usr/local")
OPENSSL_INCLUDE="$OPENSSL_PREFIX/include"
OPENSSL_LIB="$OPENSSL_PREFIX/lib"

if [ ! -d "$OPENSSL_INCLUDE" ]; then
    echo "ERROR: OpenSSL include directory not found: $OPENSSL_INCLUDE"
    exit 1
fi

# Build for arm64
echo "Building for arm64..."
ARCH_DIR_ARM="$BUILD_DIR/native_arm64"
mkdir -p "$ARCH_DIR_ARM"
cd "$ARCH_DIR_ARM"

python3 << EOF
from setuptools import setup, Extension
import sys

minr_native = Extension(
    'minr_native',
    sources=['$NATIVE_C_FILE'],
    include_dirs=['$OPENSSL_INCLUDE'],
    libraries=['crypto'],
    library_dirs=['$OPENSSL_LIB'],
    extra_compile_args=['-O3', '-arch', 'arm64'],
    extra_link_args=['-arch', 'arm64'],
)

setup(
    name='minr_native',
    version='1.0.0',
    ext_modules=[minr_native],
    zip_safe=False,
)
EOF
python3 setup.py build_ext --inplace || {
    echo "ERROR: Failed to build arm64 extension"
    exit 1
}

ARM64_SO=$(ls minr_native*.so | head -1)
if [ -z "$ARM64_SO" ]; then
    echo "ERROR: arm64 .so file not found"
    exit 1
fi

# Build for x86_64 (Intel)
echo "Building for x86_64..."
ARCH_DIR_X86="$BUILD_DIR/native_x86_64"
mkdir -p "$ARCH_DIR_X86"
cd "$ARCH_DIR_X86"

if [ "$(uname -m)" = "arm64" ]; then
    # Use arch command to force x86_64 build on Apple Silicon
    arch -x86_64 python3 << EOF
from setuptools import setup, Extension

minr_native = Extension(
    'minr_native',
    sources=['$NATIVE_C_FILE'],
    include_dirs=['$OPENSSL_INCLUDE'],
    libraries=['crypto'],
    library_dirs=['$OPENSSL_LIB'],
    extra_compile_args=['-O3', '-arch', 'x86_64'],
    extra_link_args=['-arch', 'x86_64'],
)

setup(
    name='minr_native',
    version='1.0.0',
    ext_modules=[minr_native],
    zip_safe=False,
)
EOF
    arch -x86_64 python3 setup.py build_ext --inplace || {
        echo "WARNING: x86_64 build failed (may not be needed on Apple Silicon)"
        echo "Continuing with arm64-only build..."
        cp "$ARCH_DIR_ARM/$ARM64_SO" "$NATIVE_DIR/minr_native.so"
        exit 0
    }
else
    python3 << EOF
from setuptools import setup, Extension

minr_native = Extension(
    'minr_native',
    sources=['$NATIVE_C_FILE'],
    include_dirs=['$OPENSSL_INCLUDE'],
    libraries=['crypto'],
    library_dirs=['$OPENSSL_LIB'],
    extra_compile_args=['-O3', '-arch', 'x86_64'],
    extra_link_args=['-arch', 'x86_64'],
)

setup(
    name='minr_native',
    version='1.0.0',
    ext_modules=[minr_native],
    zip_safe=False,
)
EOF
    python3 setup.py build_ext --inplace || {
        echo "ERROR: Failed to build x86_64 extension"
        exit 1
    }
fi

X86_64_SO=$(ls minr_native*.so | head -1)
if [ -z "$X86_64_SO" ]; then
    echo "WARNING: x86_64 .so file not found, using arm64-only"
    cp "$ARCH_DIR_ARM/$ARM64_SO" "$NATIVE_DIR/minr_native.so"
    exit 0
fi

# Create universal2 binary using lipo
echo "Creating universal2 binary..."
lipo -create "$ARCH_DIR_ARM/$ARM64_SO" "$ARCH_DIR_X86/$X86_64_SO" -output "$NATIVE_DIR/minr_native.so" || {
    echo "ERROR: lipo failed to create universal2 binary"
    exit 1
}

echo "✓ Universal2 native extension built: $NATIVE_DIR/minr_native.so"
file "$NATIVE_DIR/minr_native.so"
