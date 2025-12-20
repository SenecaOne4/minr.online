#!/bin/bash
# Install git on macOS

echo "=== Checking for git ==="
if command -v git &> /dev/null; then
    echo "Git is already installed:"
    git --version
    exit 0
fi

echo "Git not found. Installing..."

echo ""
echo "=== Checking for Xcode Command Line Tools ==="
if xcode-select -p &> /dev/null; then
    echo "Xcode Command Line Tools are installed"
    echo "Git should be available. Checking /usr/bin/git..."
    if [ -f /usr/bin/git ]; then
        echo "Found git at /usr/bin/git"
        /usr/bin/git --version
    else
        echo "Git not found. Installing Xcode Command Line Tools..."
        xcode-select --install
        echo "Please complete the installation dialog, then run this script again."
    fi
else
    echo "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo ""
    echo "A dialog will appear. Click 'Install' and wait for it to complete."
    echo "Then run this script again to verify installation."
fi

echo ""
echo "=== Alternative: Install via Homebrew ==="
if command -v brew &> /dev/null; then
    echo "Homebrew found. You can also install git with:"
    echo "  brew install git"
else
    echo "Homebrew not installed. Install it from: https://brew.sh"
fi



