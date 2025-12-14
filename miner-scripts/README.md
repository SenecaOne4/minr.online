# Minr.online Miner Scripts

This directory contains miner scripts and configuration for connecting to Minr.online.

## Available Miners

### 1. Standalone HTML Miner (Browser-based)
- **Best for**: Quick start, no installation
- **Performance**: Lower (browser limitations)
- **Download**: Available from `/miners` page on minr.online
- **How it works**: Single HTML file with embedded miner code

### 2. Modified cpuminer (CPU Mining)
- **Best for**: Maximum performance, dedicated mining
- **Performance**: High (native C code, optimized)
- **License**: GPL v2.0 (open source, modifiable)
- **How it works**: Fetches configuration from minr.online API, then mines

## cpuminer Modification Plan

We will fork and modify cpuminer to:
1. **Auto-configure from API**: On startup, fetch config from `https://api.minr.online/api/miner-config`
2. **Static endpoints**: All endpoints configured on minr.online site
3. **User authentication**: Uses auth token to fetch personalized config
4. **Better integration**: Reports stats back to minr.online

### Building Modified cpuminer

```bash
# Clone our fork
git clone https://github.com/MinrOnline/cpuminer-minr.git
cd cpuminer-minr

# Build
./autogen.sh
./configure CFLAGS="-O3"
make -j$(nproc)

# The binary will auto-configure from minr.online
./minerd --config-url https://api.minr.online/api/miner-config --token YOUR_AUTH_TOKEN
```

### Configuration Endpoint

The `/api/miner-config` endpoint returns:
```json
{
  "stratum": {
    "host": "ws.minr.online",
    "port": 3333,
    "endpoint": "stratum+tcp://ws.minr.online:3333"
  },
  "wallet": "bc1q...",
  "worker": "minr.username",
  "password": "x",
  "algorithm": "sha256d",
  "api": {
    "base": "https://api.minr.online",
    "stats": "https://api.minr.online/api/analytics/pool-stats"
  }
}
```

## Why cpuminer is Better

1. **Performance**: Native C code runs 10-100x faster than browser JavaScript
2. **Resource usage**: More efficient CPU utilization
3. **Stability**: Can run 24/7 without browser overhead
4. **Features**: Supports advanced mining features (threading, optimization)

## License

- **cpuminer**: GPL v2.0 (we can modify and distribute)
- **Our modifications**: GPL v2.0 (must release source code)
- **HTML miner**: Proprietary (our code)

