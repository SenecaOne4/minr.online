#!/bin/bash
# Minr.online CPU Miner Installer for macOS
# This script installs dependencies and sets up cpuminer

set -e

# Get auth token and API URL from environment or arguments
AUTH_TOKEN="${AUTH_TOKEN:-}"
API_URL="${API_URL:-https://api.minr.online}"
INSTALL_DIR="$HOME/.minr-online"
STATUS_FILE="$INSTALL_DIR/status.json"
LOG_FILE="$INSTALL_DIR/install.log"

mkdir -p "$INSTALL_DIR"
echo "{\"status\": \"installing\", \"step\": \"Initializing...\"}" > "$STATUS_FILE"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

update_status() {
    echo "{\"status\": \"$1\", \"step\": \"$2\", \"progress\": $3}" > "$STATUS_FILE"
}

log "Starting Minr.online CPU Miner installation for macOS"

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    log "Homebrew not found. Installing Homebrew..."
    update_status "installing" "Installing Homebrew..." 10
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    log "Homebrew found"
fi

update_status "installing" "Installing dependencies..." 30

# Install dependencies
log "Installing build dependencies..."
brew install automake autoconf pkg-config libcurl openssl jansson gmp git || {
    log "Error installing dependencies"
    update_status "error" "Failed to install dependencies" 0
    exit 1
}

update_status "installing" "Downloading cpuminer..." 50

# Clone cpuminer
CPUMINER_DIR="$INSTALL_DIR/cpuminer"
if [ ! -d "$CPUMINER_DIR" ]; then
    log "Cloning cpuminer repository..."
    git clone https://github.com/pooler/cpuminer.git "$CPUMINER_DIR" || {
        log "Error cloning cpuminer"
        update_status "error" "Failed to clone cpuminer" 0
        exit 1
    }
else
    log "cpuminer directory exists, updating..."
    cd "$CPUMINER_DIR"
    git pull || true
fi

update_status "installing" "Building cpuminer..." 70

# Build cpuminer
cd "$CPUMINER_DIR"
log "Building cpuminer..."
./autogen.sh || {
    log "Error running autogen.sh"
    update_status "error" "Build failed at autogen" 0
    exit 1
}

./configure CFLAGS="-O3" || {
    log "Error running configure"
    update_status "error" "Build failed at configure" 0
    exit 1
}

make -j$(sysctl -n hw.ncpu) || {
    log "Error building cpuminer"
    update_status "error" "Build failed" 0
    exit 1
}

update_status "installing" "Fetching configuration..." 85

# Fetch configuration from API
if [ -z "$AUTH_TOKEN" ]; then
    log "Warning: AUTH_TOKEN not set. Configuration will need to be set manually."
else
    log "Fetching miner configuration..."
    CONFIG_FILE="$INSTALL_DIR/config.json"
    curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/miner-config" > "$CONFIG_FILE" || {
        log "Error fetching configuration"
        update_status "error" "Failed to fetch configuration" 0
        exit 1
    }
fi

# Create launcher script
LAUNCHER_SCRIPT="$INSTALL_DIR/start-mining.sh"
cat > "$LAUNCHER_SCRIPT" << 'EOF'
#!/bin/bash
INSTALL_DIR="$HOME/.minr-online"
CONFIG_FILE="$INSTALL_DIR/config.json"
CPUMINER="$INSTALL_DIR/cpuminer/minerd"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found. Please run install script again."
    exit 1
fi

# Parse config using jq if available, otherwise use grep
if command -v jq &> /dev/null; then
    STRATUM_HOST=$(jq -r '.stratum.host' "$CONFIG_FILE")
    STRATUM_PORT=$(jq -r '.stratum.port' "$CONFIG_FILE")
    WALLET=$(jq -r '.wallet' "$CONFIG_FILE")
    WORKER=$(jq -r '.worker' "$CONFIG_FILE")
else
    STRATUM_HOST=$(grep -o '"host": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    STRATUM_PORT=$(grep -o '"port": [0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*')
    WALLET=$(grep -o '"wallet": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    WORKER=$(grep -o '"worker": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
fi

# Start mining
"$CPUMINER" -a sha256d -o "stratum+tcp://$STRATUM_HOST:$STRATUM_PORT" -u "$WALLET.$WORKER" -p x
EOF

chmod +x "$LAUNCHER_SCRIPT"

log "Installation complete!"
update_status "ready" "Installation complete" 100

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Miner installed to: $INSTALL_DIR"
echo "Start mining with: $LAUNCHER_SCRIPT"
echo ""

