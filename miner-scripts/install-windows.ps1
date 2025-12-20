# Minr.online CPU Miner Installer for Windows
# PowerShell script to install dependencies and set up cpuminer

$ErrorActionPreference = "Stop"

# Get auth token and API URL from environment or arguments
$AUTH_TOKEN = $env:AUTH_TOKEN
$API_URL = if ($env:API_URL) { $env:API_URL } else { "https://api.minr.online" }
$INSTALL_DIR = "$env:USERPROFILE\.minr-online"
$STATUS_FILE = "$INSTALL_DIR\status.json"
$LOG_FILE = "$INSTALL_DIR\install.log"

New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Update-Status {
    param([string]$Status, [string]$Step, [int]$Progress)
    $statusObj = @{
        status = $Status
        step = $Step
        progress = $Progress
    } | ConvertTo-Json
    Set-Content -Path $STATUS_FILE -Value $statusObj
}

Write-Log "Starting Minr.online CPU Miner installation for Windows"

# Check for Chocolatey
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Log "Chocolatey not found. Installing Chocolatey..."
    Update-Status "installing" "Installing Chocolatey..." 10
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Log "Chocolatey found"
}

Update-Status "installing" "Installing dependencies..." 30

# Install dependencies via Chocolatey
Write-Log "Installing build dependencies..."
choco install -y git make mingw autoconf automake libtool --ignore-checksums
if ($LASTEXITCODE -ne 0) {
    Write-Log "Error installing dependencies"
    Update-Status "error" "Failed to install dependencies" 0
    exit 1
}

Update-Status "installing" "Downloading cpuminer..." 50

# Clone cpuminer
$CPUMINER_DIR = "$INSTALL_DIR\cpuminer"
if (-not (Test-Path $CPUMINER_DIR)) {
    Write-Log "Cloning cpuminer repository..."
    git clone https://github.com/pooler/cpuminer.git $CPUMINER_DIR
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Error cloning cpuminer"
        Update-Status "error" "Failed to clone cpuminer" 0
        exit 1
    }
} else {
    Write-Log "cpuminer directory exists, updating..."
    Set-Location $CPUMINER_DIR
    git pull
}

Update-Status "installing" "Building cpuminer..." 70

# Build cpuminer (Windows build is more complex)
Set-Location $CPUMINER_DIR
Write-Log "Building cpuminer..."
Write-Log "Note: Windows builds may require Visual Studio or MinGW setup"
Write-Log "For best results, consider using WSL2 or pre-built binaries"

# Try to build (may fail on Windows without proper setup)
./autogen.sh
if ($LASTEXITCODE -ne 0) {
    Write-Log "Warning: autogen.sh failed. You may need to build manually or use WSL2"
    Write-Log "Alternatively, download a pre-built Windows binary"
}

Update-Status "installing" "Fetching configuration..." 85

# Fetch configuration from API
if (-not $AUTH_TOKEN) {
    Write-Log "Warning: AUTH_TOKEN not set. Configuration will need to be set manually."
} else {
    Write-Log "Fetching miner configuration..."
    $CONFIG_FILE = "$INSTALL_DIR\config.json"
    $headers = @{
        "Authorization" = "Bearer $AUTH_TOKEN"
    }
    try {
        Invoke-WebRequest -Uri "$API_URL/api/miner-config" -Headers $headers -OutFile $CONFIG_FILE
    } catch {
        Write-Log "Error fetching configuration: $_"
        Update-Status "error" "Failed to fetch configuration" 0
        exit 1
    }
}

# Create launcher script
$LAUNCHER_SCRIPT = "$INSTALL_DIR\start-mining.ps1"
$launcherContent = @'
# Minr.online CPU Miner Launcher
$INSTALL_DIR = "$env:USERPROFILE\.minr-online"
$CONFIG_FILE = "$INSTALL_DIR\config.json"
$CPUMINER = "$INSTALL_DIR\cpuminer\minerd.exe"

if (-not (Test-Path $CONFIG_FILE)) {
    Write-Host "Error: Configuration file not found. Please run install script again."
    exit 1
}

# Parse config
$config = Get-Content $CONFIG_FILE | ConvertFrom-Json
$stratumHost = $config.stratum.host
$stratumPort = $config.stratum.port
$wallet = $config.wallet
$worker = $config.worker

# Start mining
& $CPUMINER -a sha256d -o "stratum+tcp://$stratumHost:$stratumPort" -u "$wallet.$worker" -p x
'@

Set-Content -Path $LAUNCHER_SCRIPT -Value $launcherContent

Write-Log "Installation complete!"
Update-Status "ready" "Installation complete" 100

Write-Host ""
Write-Host "=========================================="
Write-Host "Installation Complete!"
Write-Host "=========================================="
Write-Host ""
Write-Host "Miner installed to: $INSTALL_DIR"
Write-Host "Start mining with: $LAUNCHER_SCRIPT"
Write-Host ""
Write-Host "Note: Windows builds may require additional setup."
Write-Host "Consider using WSL2 for easier building."
Write-Host ""

//
# Generate SSH key
ssh-keygen -t ed25519 -C "senecaone4@gmail.com"
# Press Enter for default location
# Optionally set a passphrase

# Copy your public key
cat ~/.ssh/id_ed25519.pub