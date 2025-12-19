# Performance Optimization Guide

## Overview

The Python Stratum miner has been optimized for maximum performance while maintaining Stratum V1 protocol correctness. The miner uses runtime backend selection to automatically choose the fastest available SHA256 implementation.

## Performance Improvements

### Before Optimization
- **Hashrate**: ~120k H/s total (4 workers × ~30k H/s each)
- **Backend**: Pure Python `hashlib.sha256()` (slow)
- **Hot Loop**: Hex decoding, allocations, and debug logging per hash

### After Optimization
- **Hashrate**: >1 MH/s with OpenSSL backend, higher with pycryptodome
- **Backend**: Runtime selection of fastest available (pycryptodome > hashlib/OpenSSL)
- **Hot Loop**: Precomputed data, minimal allocations, debug logging removed

## Optional Dependencies for Maximum Performance

### Install pycryptodome (Recommended)

For best performance, install `pycryptodome` which provides a fast C implementation:

```bash
pip3 install pycryptodome
```

The miner will automatically detect and use pycryptodome if available. If not installed, it falls back to `hashlib` (OpenSSL-backed), which is still much faster than pure Python.

### Verify Backend Selection

Run with `--profile` mode to see which backend is selected:

```bash
python3 ~/.minr-online/minr-stratum-miner.py 4 --profile
```

You should see output like:
```
[PROFILE Worker 0] Using SHA256 backend: pycryptodome
```

or

```
[PROFILE Worker 0] Using SHA256 backend: hashlib (OpenSSL)
```

## Benchmark Mode

Test raw hashing performance without Stratum connection:

```bash
python3 ~/.minr-online/minr-stratum-miner.py 4 --bench
```

This will:
1. Select the fastest available SHA256 backend
2. Run 4 workers hashing a fixed header for 5 seconds
3. Report total hashrate and per-worker performance

Example output:
```
============================================================
Minr.online Python Stratum Miner - BENCHMARK MODE
============================================================
SHA256 Backend: pycryptodome
Workers: 4
CPU Cores: 10
============================================================
Running benchmark for 5 seconds...
============================================================
BENCHMARK RESULTS
============================================================
Total hashes: 5,234,567
Total hashrate: 1,046,913 H/s
Per worker: 261,728 H/s
Backend: pycryptodome
============================================================
```

## Profile Mode

Monitor performance during actual mining:

```bash
python3 ~/.minr-online/minr-stratum-miner.py 4 --profile
```

This shows:
- SHA256 backend selection
- Batch completion times and hashrate per worker
- Performance statistics every 100 batches

## Optimizations Implemented

1. **Runtime SHA256 Backend Selection**
   - Automatically selects fastest available backend
   - Falls back gracefully if optional dependencies missing

2. **Precomputed Per-Job Data**
   - Coinbase template precomputed (coinb1 + extranonce1 + coinb2)
   - Merkle branches converted to bytes once per job
   - Header static fields set once per batch

3. **Optimized Hot Loop**
   - Only mutates nonce bytes in header (last 4 bytes)
   - Uses `bytearray` and `struct.pack_into()` to avoid allocations
   - Removed hex decoding from hot loop
   - Debug logging moved outside hot loop

4. **Efficient Multiprocessing**
   - Each worker scans unique nonce range
   - Per-worker local counters
   - Shared counter updated every 100k hashes (reduces lock contention)

## Expected Performance

On a modern CPU (e.g., 10-core MacBook Pro):

- **Without pycryptodome**: ~1-2 MH/s total
- **With pycryptodome**: ~2-5 MH/s total (varies by CPU)

Performance scales linearly with CPU cores. Use `multiprocessing.cpu_count()` workers for maximum throughput.

## Troubleshooting

### Low Hashrate

1. Check backend selection:
   ```bash
   python3 ~/.minr-online/minr-stratum-miner.py 4 --profile
   ```

2. Install pycryptodome if using hashlib:
   ```bash
   pip3 install pycryptodome
   ```

3. Verify CPU utilization:
   - Use `top` or `htop` to check all CPU cores are at 100%
   - If not, increase worker count: `python3 ~/.minr-online/minr-stratum-miner.py 8`

### Hashrate Shows 0.00 H/s

This was a bug in the hashrate calculation (now fixed). If you see this:
1. Ensure workers are running (check `--profile` output)
2. Wait at least 10 seconds for first hashrate report
3. Verify job is active (workers need a Stratum job to mine)

## Notes

- The miner maintains full Stratum V1 protocol correctness
- All optimizations preserve share submission and acceptance tracking
- Debug mode (`--debug-stratum`) still works but logs are outside hot loop
- Benchmark mode tests raw hashing, not Stratum protocol correctness

