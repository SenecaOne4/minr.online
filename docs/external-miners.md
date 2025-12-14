# External Miner Connection Guide

Minr.online supports external miners (cpuminer, ASIC miners, etc.) connecting directly to the Stratum pool.

## Connection Details

- **Stratum Endpoint**: `stratum+tcp://ws.minr.online:3333`
- **Username**: Your Bitcoin wallet address (set in profile)
- **Password**: `x` (standard Stratum password)

## Supported Miners

- **cpuminer** (CPU mining)
- **cgminer** (GPU/ASIC)
- **bfgminer** (FPGA/ASIC)
- **Any Stratum-compatible miner**

## Configuration Examples

### cpuminer

```bash
./cpuminer -a sha256d \
  -o stratum+tcp://ws.minr.online:3333 \
  -u YOUR_BITCOIN_ADDRESS \
  -p x
```

### cgminer

```bash
./cgminer -o stratum+tcp://ws.minr.online:3333 \
  -u YOUR_BITCOIN_ADDRESS \
  -p x \
  -a sha256d
```

### bfgminer

```bash
./bfgminer -o stratum+tcp://ws.minr.online:3333 \
  -u YOUR_BITCOIN_ADDRESS \
  -p x \
  -S sha256d
```

## Desktop Miner Script

Users who have paid the entry fee can download a pre-configured Python miner:

1. Log in to dashboard
2. Click "Download Desktop Miner"
3. Run the script:
   ```bash
   python minr-miner.py
   ```

The script includes:
- Pre-configured connection settings
- Your Bitcoin wallet address
- GUI and CLI modes
- Statistics reporting

## Requirements

- **Entry Fee**: Must pay $1 USD entry fee first
- **Profile**: Bitcoin payout address must be set
- **Account**: Must be logged in (for download)

## Troubleshooting

### Connection Refused

- Verify entry fee is paid
- Check Bitcoin address is set in profile
- Ensure miner is using correct endpoint

### Shares Not Accepted

- Check difficulty is appropriate for your hardware
- Verify miner is using correct username (Bitcoin address)
- Check pool difficulty settings

### Authentication Failed

- Ensure username is your Bitcoin wallet address
- Password should be `x`
- Verify account has paid entry fee

## Pool Statistics

View pool stats:
- Dashboard shows your performance
- Miner page shows pool-wide statistics
- API endpoint: `/api/analytics/pool-stats`

## Support

For issues:
1. Check payment status in dashboard
2. Verify profile Bitcoin address
3. Review miner logs for errors
4. Contact admin if problems persist

