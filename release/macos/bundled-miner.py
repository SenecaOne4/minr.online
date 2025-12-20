#!/usr/bin/env python3
"""
Minr.online macOS Bundled Miner
Self-contained miner with forced native mode and config fetching
"""
import sys
import os
import json
import urllib.request
import urllib.error
import time
import multiprocessing

# Force native mode - no fallback
USE_NATIVE = True

# Import miner script (will be bundled as data)
# We'll import it dynamically by adding the build dir to path
if getattr(sys, 'frozen', False):
    # PyInstaller bundle - miner script is in _MEIPASS
    bundle_dir = sys._MEIPASS
    sys.path.insert(0, bundle_dir)
    # Import as if it's a module (PyInstaller will include it)
    import minr_stratum_miner as miner_module
else:
    # Development mode - add project root to path
    project_root = os.path.join(os.path.dirname(__file__), '../..')
    sys.path.insert(0, project_root)
    from miner_scripts import minr_stratum_miner as miner_module

# Get config from environment or API
def fetch_config():
    """Fetch config from API or use environment variables"""
    api_url = os.environ.get('MINR_API_URL', 'https://api.minr.online')
    auth_token = os.environ.get('MINR_AUTH_TOKEN', '')
    
    # Try environment variables first
    config = {
        'wallet': os.environ.get('MINR_WALLET'),
        'worker': os.environ.get('MINR_WORKER'),
        'host': os.environ.get('MINR_HOST'),
        'port': int(os.environ.get('MINR_PORT', '3333')),
        'email': os.environ.get('MINR_EMAIL'),
        'threads': int(os.environ.get('MINR_THREADS', '0')),
    }
    
    # If auth token provided, fetch from API
    if auth_token and not all([config['wallet'], config['worker'], config['host']]):
        print("Fetching configuration from API...")
        try:
            req = urllib.request.Request(
                f"{api_url}/api/miner-config",
                headers={'Authorization': f'Bearer {auth_token}'}
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                api_config = json.loads(response.read().decode())
                config.update({
                    'wallet': api_config.get('wallet', config['wallet']),
                    'worker': api_config.get('worker', config['worker']),
                    'host': api_config['stratum']['host'],
                    'port': api_config['stratum']['port'],
                    'email': api_config.get('user_email', config['email']),
                })
                print(f"✓ Configuration loaded: {config['wallet']} @ {config['host']}:{config['port']}")
        except urllib.error.HTTPError as e:
            print(f"ERROR: Failed to fetch config (HTTP {e.code})")
            if e.code == 403:
                print("  Entry fee payment required.")
            elif e.code == 401:
                print("  Authentication failed. Please download a fresh bundle.")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR: Failed to fetch config: {e}")
            sys.exit(1)
    
    # Validate required fields
    if not all([config['wallet'], config['worker'], config['host']]):
        print("ERROR: Missing required configuration")
        print("Set MINR_WALLET, MINR_WORKER, MINR_HOST, MINR_PORT or MINR_AUTH_TOKEN")
        sys.exit(1)
    
    return config

def run_self_test():
    """Run 3-second benchmark to verify native backend"""
    print("=" * 60)
    print("Minr.online CPU Miner - macOS Bundle")
    print("=" * 60)
    
    # Check native module
    try:
        import minr_native
        if not hasattr(minr_native, 'scan_nonces'):
            print("✗ ERROR: Native backend missing scan_nonces")
            sys.exit(1)
    except ImportError:
        print("✗ ERROR: Native backend (minr_native) not available")
        print("  This bundle requires the native extension.")
        print("  Please download a fresh bundle or contact support.")
        sys.exit(1)
    
    print("✓ Native backend: ENABLED (minr_native.scan_nonces)")
    
    # Run 3-second benchmark
    print("Running self-test (3 seconds)...")
    
    # Create a test header (80 bytes)
    import hashlib
    test_header = bytearray(80)
    test_header[0:4] = b'\x01\x00\x00\x00'  # version
    test_header[4:36] = hashlib.sha256(b'test').digest()  # prevhash
    test_header[36:68] = hashlib.sha256(b'merkle').digest()  # merkle_root
    test_header[68:72] = b'\x00\x00\x00\x00'  # ntime
    test_header[72:76] = b'\xff\xff\x00\x1d'  # nbits
    test_header[76:80] = b'\x00\x00\x00\x00'  # nonce
    
    # Target (difficulty 1)
    target_bytes = bytes.fromhex('00000000ffff0000000000000000000000000000000000000000000000000000')
    
    start_time = time.time()
    hashes_done = 0
    test_duration = 3.0
    batch_size = 100000  # Scan 100k nonces per call
    
    while time.time() - start_time < test_duration:
        # Call native scan_nonces
        result = minr_native.scan_nonces(test_header, 0, batch_size, target_bytes)
        if isinstance(result, tuple):
            # Returns (hashes_done, found_count, found_nonces, found_hashes)
            hashes_done += result[0]
        elif isinstance(result, int):
            # Returns just hashes_done
            hashes_done += result
        else:
            # Fallback: assume batch_size
            hashes_done += batch_size
    
    elapsed = time.time() - start_time
    hashrate = hashes_done / elapsed if elapsed > 0 else 0
    
    print(f"Self-test result: {hashrate:,.0f} H/s")
    
    if hashrate < 1_000_000:
        print("✗ ERROR: Native backend not active (hashrate too low)")
        print(f"  Expected: > 1,000,000 H/s")
        print(f"  Got: {hashrate:,.0f} H/s")
        print("  This indicates the native extension is not working correctly.")
        sys.exit(1)
    
    print("✓ Native OK: {:.1f} MH/s".format(hashrate / 1_000_000))
    print("=" * 60)
    print()

def main():
    """Main entry point"""
    # Self-test first
    run_self_test()
    
    # Fetch config
    config = fetch_config()
    
    # Set environment variables for miner script
    os.environ['BTC_WALLET'] = config['wallet']
    os.environ['WORKER_NAME'] = config['worker']
    os.environ['STRATUM_HOST'] = config['host']
    os.environ['STRATUM_PORT'] = str(config['port'])
    os.environ['USER_EMAIL'] = config.get('email', '')
    
    # Set USE_NATIVE in miner module
    miner_module.USE_NATIVE = True
    
    # Override config in miner module
    miner_module.BTC_WALLET = config['wallet']
    miner_module.WORKER_NAME = config['worker']
    miner_module.STRATUM_HOST = config['host']
    miner_module.STRATUM_PORT = config['port']
    miner_module.USER_EMAIL = config.get('email', '')
    
    # Determine thread count
    num_threads = config['threads']
    if num_threads == 0:
        num_threads = min(multiprocessing.cpu_count(), 10)
    
    # Launch miner
    print(f"Starting miner with {num_threads} threads...")
    print()
    
    # Call miner's main with thread count
    sys.argv = [sys.argv[0], str(num_threads), '--native']
    miner_module.main()

if __name__ == "__main__":
    main()

