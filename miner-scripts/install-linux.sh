#!/bin/bash
# Minr.online CPU Miner Installer for Linux
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

log "Starting Minr.online CPU Miner installation for Linux"

# Detect Linux distribution
if [ -f /etc/debian_version ]; then
    DISTRO="debian"
elif [ -f /etc/redhat-release ]; then
    DISTRO="redhat"
elif [ -f /etc/arch-release ]; then
    DISTRO="arch"
else
    DISTRO="unknown"
fi

log "Detected distribution: $DISTRO"

update_status "installing" "Installing dependencies..." 20

# Install dependencies based on distribution
if [ "$DISTRO" = "debian" ]; then
    log "Installing dependencies via apt..."
    sudo apt-get update
    sudo apt-get install -y build-essential libcurl4-openssl-dev libjansson-dev libssl-dev libgmp-dev automake autoconf pkg-config git || {
        log "Error installing dependencies"
        update_status "error" "Failed to install dependencies" 0
        exit 1
    }
elif [ "$DISTRO" = "redhat" ]; then
    log "Installing dependencies via yum/dnf..."
    if command -v dnf &> /dev/null; then
        sudo dnf install -y gcc make automake autoconf pkg-config libcurl-devel jansson-devel openssl-devel gmp-devel git || {
            log "Error installing dependencies"
            update_status "error" "Failed to install dependencies" 0
            exit 1
        }
    else
        sudo yum install -y gcc make automake autoconf pkgconfig libcurl-devel jansson-devel openssl-devel gmp-devel git || {
            log "Error installing dependencies"
            update_status "error" "Failed to install dependencies" 0
            exit 1
        }
    fi
elif [ "$DISTRO" = "arch" ]; then
    log "Installing dependencies via pacman..."
    sudo pacman -S --noconfirm base-devel curl jansson openssl gmp git || {
        log "Error installing dependencies"
        update_status "error" "Failed to install dependencies" 0
        exit 1
    }
else
    log "Unknown distribution. Please install dependencies manually:"
    log "  build-essential, libcurl4-openssl-dev, libjansson-dev, libssl-dev, libgmp-dev, automake, autoconf, pkg-config, git"
    update_status "error" "Unknown distribution" 0
    exit 1
fi

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

make -j$(nproc) || {
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

# Parse config - try jq first, fallback to python, then grep
if command -v jq &> /dev/null; then
    STRATUM_HOST=$(jq -r '.stratum.host' "$CONFIG_FILE")
    STRATUM_PORT=$(jq -r '.stratum.port' "$CONFIG_FILE")
    WALLET=$(jq -r '.wallet' "$CONFIG_FILE")
    WORKER=$(jq -r '.worker' "$CONFIG_FILE")
elif command -v python3 &> /dev/null; then
    STRATUM_HOST=$(python3 -c "import json; f=open('$CONFIG_FILE'); d=json.load(f); print(d['stratum']['host'])" 2>/dev/null)
    STRATUM_PORT=$(python3 -c "import json; f=open('$CONFIG_FILE'); d=json.load(f); print(d['stratum']['port'])" 2>/dev/null)
    WALLET=$(python3 -c "import json; f=open('$CONFIG_FILE'); d=json.load(f); print(d['wallet'])" 2>/dev/null)
    WORKER=$(python3 -c "import json; f=open('$CONFIG_FILE'); d=json.load(f); print(d['worker'])" 2>/dev/null)
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

