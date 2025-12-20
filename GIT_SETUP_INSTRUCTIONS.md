# Git CLI Setup for macOS

## Step 1: Install Git

**Check if git is already installed:**
```bash
git --version
```

**If not installed, install Xcode Command Line Tools:**
```bash
xcode-select --install
```
- A dialog will appear
- Click "Install"
- Wait for installation to complete (10-15 minutes)

**Or install via Homebrew (if you have it):**
```bash
brew install git
```

## Step 2: Configure Git

**Set your name:**
```bash
git config --global user.name "Your Name"
```

**Set your email:**
```bash
git config --global user.email "your.email@example.com"
```

**Verify configuration:**
```bash
git config --list --global
```

## Step 3: Set Up GitHub Authentication

### Option A: SSH Keys (Recommended)

**Generate an SSH key:**
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```
- Press Enter to accept default location
- Optionally set a passphrase

**Copy your public key:**
```bash
cat ~/.ssh/id_ed25519.pub
```

**Add to GitHub:**
1. Go to: https://github.com/settings/keys
2. Click "New SSH key"
3. Paste your public key
4. Click "Add SSH key"

**Test connection:**
```bash
ssh -T git@github.com
```
Should say: "Hi username! You've successfully authenticated..."

### Option B: Personal Access Token (HTTPS)

**Create a token:**
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (full control)
4. Generate and copy the token

**Use token when pushing:**
```bash
git push origin main
# Username: your_github_username
# Password: paste_your_token_here
```

**Or store credentials:**
```bash
git config --global credential.helper osxkeychain
```

## Step 4: Test Git

**Check git is working:**
```bash
cd /Users/seneca/Desktop/minr.online
git status
git log --oneline -5
```

**Push your changes:**
```bash
git add backend/src/routes/cpu-miner-launcher.ts
git commit -m "Fix: Python Miner Installer"
git push origin main
```

## Quick Setup Script

Run the automated setup script:
```bash
cd /Users/seneca/Desktop/minr.online
./setup-git-mac.sh
```

This will:
- Check if git is installed
- Configure your name and email
- Check for SSH keys
- Test GitHub connection



