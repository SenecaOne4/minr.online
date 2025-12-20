#!/bin/bash
# Setup Git CLI on macOS

echo "=== Git Setup for macOS ==="
echo ""

# Step 1: Check if git is installed
echo "Step 1: Checking if git is installed..."
if command -v git &> /dev/null; then
    echo "✓ Git is already installed:"
    git --version
else
    echo "✗ Git is not installed"
    echo ""
    echo "Installing Xcode Command Line Tools..."
    echo "This will open a dialog - click 'Install' and wait for completion."
    xcode-select --install
    
    echo ""
    echo "After installation completes, run this script again to configure git."
    exit 0
fi

echo ""
echo "Step 2: Checking git configuration..."

# Check if user.name is set
if git config --global user.name &> /dev/null; then
    echo "✓ Git user.name is set: $(git config --global user.name)"
else
    echo "✗ Git user.name is not set"
    read -p "Enter your name for git commits: " GIT_NAME
    git config --global user.name "$GIT_NAME"
    echo "✓ Set user.name to: $GIT_NAME"
fi

# Check if user.email is set
if git config --global user.email &> /dev/null; then
    echo "✓ Git user.email is set: $(git config --global user.email)"
else
    echo "✗ Git user.email is not set"
    read -p "Enter your email for git commits: " GIT_EMAIL
    git config --global user.email "$GIT_EMAIL"
    echo "✓ Set user.email to: $GIT_EMAIL"
fi

echo ""
echo "Step 3: Checking SSH key for GitHub..."

if [ -f ~/.ssh/id_ed25519 ] || [ -f ~/.ssh/id_rsa ]; then
    echo "✓ SSH key found"
    if [ -f ~/.ssh/id_ed25519.pub ]; then
        echo "Public key:"
        cat ~/.ssh/id_ed25519.pub
    elif [ -f ~/.ssh/id_rsa.pub ]; then
        echo "Public key:"
        cat ~/.ssh/id_rsa.pub
    fi
else
    echo "✗ No SSH key found"
    echo ""
    echo "To generate an SSH key for GitHub:"
    echo "  ssh-keygen -t ed25519 -C \"your_email@example.com\""
    echo ""
    echo "Then add it to GitHub:"
    echo "  1. Copy the public key: cat ~/.ssh/id_ed25519.pub"
    echo "  2. Go to: https://github.com/settings/keys"
    echo "  3. Click 'New SSH key' and paste the key"
fi

echo ""
echo "Step 4: Testing GitHub connection..."

if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo "✓ GitHub SSH connection works!"
else
    echo "✗ GitHub SSH connection failed"
    echo "You may need to:"
    echo "  1. Generate an SSH key (see above)"
    echo "  2. Add it to your GitHub account"
    echo "  3. Or use HTTPS with a personal access token"
fi

echo ""
echo "=== Git Setup Complete ==="
echo ""
echo "Current git configuration:"
git config --list --global | grep -E "user.name|user.email"

echo ""
echo "To push to GitHub, you can use:"
echo "  git push origin main"
echo ""
echo "If authentication fails, you may need to:"
echo "  1. Use a personal access token (GitHub Settings > Developer settings > Personal access tokens)"
echo "  2. Or set up SSH keys (see above)"



