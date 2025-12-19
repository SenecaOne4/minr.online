#!/usr/bin/env python3
"""
Minr.online Python Stratum Miner
A complete Python implementation of a Bitcoin Stratum miner.
Optimized for performance with native SHA256 backends.

This miner connects directly to the Stratum pool and mines Bitcoin blocks.
"""

import sys
import time
import hashlib
import json
import socket
import struct
import threading
import multiprocessing
from datetime import datetime
from typing import Optional, Dict, Any, Callable, Tuple

# Configuration - These are replaced when script is generated
USER_EMAIL = "{{USER_EMAIL}}"
BTC_WALLET = "{{BTC_WALLET}}"
STRATUM_HOST = "{{STRATUM_HOST}}"
STRATUM_PORT = {{STRATUM_PORT}}
WORKER_NAME = "{{WORKER_NAME}}"
API_URL = "{{API_URL}}"
AUTH_TOKEN = "{{AUTH_TOKEN}}"

# Debug mode flag (set via --debug-stratum CLI arg)
DEBUG_STRATUM = False
TEST_LOW_DIFF = False
BENCH_MODE = False
PROFILE_MODE = False

# SHA256 backend selection (runtime optimization)
_sha256_backend_name = None
_sha256_backend = None

def _select_sha256_backend() -> Tuple[str, Callable]:
    """Select the fastest available SHA256 backend at runtime."""
    global _sha256_backend_name, _sha256_backend
    
    if _sha256_backend is not None:
        return _sha256_backend_name, _sha256_backend
    
    # Try pycryptodome first (fastest, C implementation)
    try:
        from Crypto.Hash import SHA256 as Crypto_SHA256
        def crypto_sha256(data):
            h = Crypto_SHA256.new()
            h.update(data)
            return h.digest()
        
        # Test it works
        test_data = b"test"
        result = crypto_sha256(crypto_sha256(test_data))
        if len(result) == 32:
            _sha256_backend_name = "pycryptodome"
            _sha256_backend = crypto_sha256
            return _sha256_backend_name, _sha256_backend
    except ImportError:
        pass
    
    # Fallback to hashlib (OpenSSL-backed, still fast)
    def hashlib_sha256(data):
        return hashlib.sha256(data).digest()
    
    _sha256_backend_name = "hashlib (OpenSSL)"
    _sha256_backend = hashlib_sha256
    return _sha256_backend_name, _sha256_backend

def sha256d(data: bytes) -> bytes:
    """Double SHA256: SHA256(SHA256(data))"""
    backend_name, backend = _select_sha256_backend()
    return backend(backend(data))


def run_benchmark(num_threads: int):
    """Benchmark mode: test hashing performance without Stratum connection."""
    print("=" * 60)
    print("Minr.online Python Stratum Miner - BENCHMARK MODE")
    print("=" * 60)
    
    # Select backend
    backend_name, sha256_func = _select_sha256_backend()
    print(f"SHA256 Backend: {backend_name}")
    print(f"Workers: {num_threads}")
    print(f"CPU Cores: {multiprocessing.cpu_count()}")
    print("=" * 60)
    
    # Create a fixed 80-byte header for benchmarking
    # This simulates a real Bitcoin block header
    test_header = bytearray(80)
    test_header[0:4] = struct.pack("<I", 0x20000000)  # version
    test_header[4:36] = b'\x00' * 32  # prevhash (zeros)
    test_header[36:68] = b'\x00' * 32  # merkle_root (zeros)
    test_header[68:72] = struct.pack("<I", 0x1d00ffff)  # nbits
    test_header[72:76] = struct.pack("<I", int(time.time()))  # ntime
    test_header[76:80] = struct.pack("<I", 0)  # nonce
    
    # Shared counter for total hashes
    shared_total_hashes = multiprocessing.Value('q', 0)
    shared_running = multiprocessing.Value('b', True)
    
    def bench_worker(worker_id: int, shared_total_hashes, shared_running):
        """Benchmark worker: hash fixed header with varying nonce."""
        backend_name, sha256_func = _select_sha256_backend()
        
        # Create local copy of header
        header_buf = bytearray(test_header)
        nonce_start = worker_id * 0x1000000
        nonce = nonce_start
        nonce_end = (worker_id + 1) * 0x1000000
        
        local_count = 0
        
        while shared_running.value:
            # Mutate only nonce bytes
            struct.pack_into("<I", header_buf, 76, nonce)
            
            # Double SHA256 using backend directly
            hash1 = sha256_func(bytes(header_buf))
            hash2 = sha256_func(hash1)
            
            local_count += 1
            nonce += 1
            
            if nonce >= nonce_end:
                nonce = nonce_start
            
            # Update shared counter every 100k hashes
            if local_count % 100000 == 0:
                with shared_total_hashes.get_lock():
                    shared_total_hashes.value += 100000
        
        # Final update
        with shared_total_hashes.get_lock():
            shared_total_hashes.value += local_count % 100000
    
    # Start workers
    processes = []
    for i in range(num_threads):
        p = multiprocessing.Process(target=bench_worker, args=(i, shared_total_hashes, shared_running), daemon=True)
        p.start()
        processes.append(p)
    
    # Run for 5 seconds
    print("Running benchmark for 5 seconds...")
    time.sleep(5)
    
    # Stop workers
    shared_running.value = False
    for p in processes:
        p.join(timeout=1)
    
    # Get final count
    with shared_total_hashes.get_lock():
        total_hashes = shared_total_hashes.value
    
    total_hps = total_hashes / 5.0
    per_worker_hps = total_hps / num_threads
    
    print("=" * 60)
    print("BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Total hashes: {total_hashes:,}")
    print(f"Total hashrate: {total_hps:,.0f} H/s")
    print(f"Per worker: {per_worker_hps:,.0f} H/s")
    print(f"Backend: {backend_name}")
    print("=" * 60)


# Standalone function for multiprocessing (must be outside class to avoid pickling issues)
def mine_worker_process(worker_id: int, shared_total_hashes, shared_running, shared_job, share_queue, debug_mode=False):
    """Mining worker process (multiprocessing - bypasses GIL for true parallelism)"""
    # #region agent log
    import os
    log_path = "/Users/seneca/Desktop/minr.online/.cursor/debug.log"
    try:
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"perf-debug","hypothesisId":"A","location":"mine_worker_process:start","message":"Worker started","data":{"worker_id":worker_id},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    
    # Wait for first job
    wait_start = time.time()
    while shared_running.value and not shared_job:
        time.sleep(0.1)
    wait_time = time.time() - wait_start
    
    # #region agent log
    try:
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"perf-debug","hypothesisId":"B","location":"mine_worker_process:job_wait","message":"Waited for job","data":{"worker_id":worker_id,"wait_seconds":wait_time,"has_job":bool(shared_job)},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    
    if not shared_running.value:
        return
    
    # Cache methods locally for speed
    pack_i = struct.pack
    from_bytes = int.from_bytes
    
    # Get SHA256 backend (fastest available)
    backend_name, sha256_func = _select_sha256_backend()
    if PROFILE_MODE and worker_id == 0:
        print(f"[PROFILE Worker {worker_id}] Using SHA256 backend: {backend_name}")
    
    # Pre-compute constants
    nonce_mask = 0xFFFFFFFF
    nonce_start = worker_id * 0x1000000
    nonce_end = (worker_id + 1) * 0x1000000
    
    # Main mining loop - restart when new jobs arrive
    job_id = ""
    # Default target (max target for difficulty 1.0) - interpreted as big-endian integer
    target = 0x00000000FFFF0000000000000000000000000000000000000000000000000000
    
    # Precomputed per-job data (avoids hex decoding in hot loop)
    coinb1_bytes = b""
    coinb2_bytes = b""
    extranonce1_bytes = b""
    merkle_root_precomputed = b""  # Precomputed merkle root bytes (little-endian, ready for header)
    version_bytes = b""
    prevhash_bytes = b""
    nbits_bytes = b""
    extranonce2_size = 4
    job_ntime = ""  # ntime from job (minimum time)
    
    # Local hash counter (64-bit unsigned)
    local_hash_count = 0
    loop_count = 0
    batch_count = 0
    last_batch_time = time.time()
    log_path = "/Users/seneca/Desktop/minr.online/.cursor/debug.log"
            
    while shared_running.value:
        # Get current job from shared memory (may change during mining)
        if not shared_job:
            # #region agent log
            try:
                with open(log_path, "a") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"perf-debug","hypothesisId":"C","location":"mine_worker_process:no_job","message":"Worker waiting - no job","data":{"worker_id":worker_id},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            time.sleep(0.01)  # Brief wait for job
            continue
        
        # Update job info if it changed
        current_job_id = shared_job.get("job_id", "")
        if current_job_id != job_id:
            job_id = current_job_id
            target = shared_job.get("target", 0x00000000FFFF0000000000000000000000000000000000000000000000000000)
            if isinstance(target, str):
                target = int(target, 16)
            
            # Precompute all job data (hex -> bytes conversion done once per job)
            coinb1_hex = shared_job.get("coinb1", "")
            coinb2_hex = shared_job.get("coinb2", "")
            extranonce1_hex = shared_job.get("extranonce1", "")
            merkle_branches = shared_job.get("merkle_branches", [])
            version_str = shared_job.get("version", "20000000")
            nbits_hex = shared_job.get("nbits", "")
            prevhash_hex = shared_job.get("prevhash", "")
            extranonce2_size = shared_job.get("extranonce2_size", 4)
            job_ntime = shared_job.get("ntime", "")
            
            # Convert hex strings to bytes once per job
            coinb1_bytes = bytes.fromhex(coinb1_hex)
            coinb2_bytes = bytes.fromhex(coinb2_hex)
            extranonce1_bytes = bytes.fromhex(extranonce1_hex)
            
            # Precompute merkle root for extranonce2=0 (we'll update it per nonce, but structure is same)
            # For now, compute with placeholder extranonce2 (will be updated in loop)
            # Actually, merkle root depends on extranonce2, so we can't fully precompute it
            # But we can precompute the merkle branches processing
            
            # Convert version, prevhash, nbits to bytes (little-endian for header)
            if isinstance(version_str, str):
                version_int = int(version_str, 16) if version_str.startswith(('0x', '0X')) or all(c in '0123456789abcdefABCDEF' for c in version_str) else int(version_str)
            else:
                version_int = version_str
            version_bytes = pack_i("<I", version_int)
            prevhash_bytes = bytes.fromhex(prevhash_hex)[::-1]  # Reverse for little-endian
            nbits_bytes = bytes.fromhex(nbits_hex)[::-1]
            
            # Precompute merkle branches as bytes (avoid hex decode in loop)
            merkle_branches_bytes = [bytes.fromhex(branch) for branch in merkle_branches]
            
            # Reset nonce range for new job
            nonce = nonce_start
            
            if debug_mode:
                # Print full target value (not truncated) to verify calculation
                target_hex_full = hex(target)
                print(f"[DEBUG Worker {worker_id}] New job: {job_id}, target_full={target_hex_full}, target_int={target}, extranonce2_size={extranonce2_size}")
                # Also print max_target for comparison
                max_target = 0x00000000FFFF0000000000000000000000000000000000000000000000000000
                print(f"[DEBUG Worker {worker_id}] Max target: {hex(max_target)}, difficulty should be: {max_target // target if target > 0 else 'N/A'}")
                # Log first hash check details (will be done once before loop)
                print(f"[DEBUG Worker {worker_id}] Will log first 10 hash checks for this job")
            
            if PROFILE_MODE and worker_id == 0:
                print(f"[PROFILE Worker {worker_id}] Job update: precomputed coinbase template, merkle branches={len(merkle_branches_bytes)}")
            
            # Debug: log first few hash checks ONCE per job (not in hot loop)
            debug_hash_count = 0
        
        try:
            # Process batches for maximum throughput
            batch_size = 100000
            # Use job's ntime as minimum, but can use current time if later
            if job_ntime:
                try:
                    job_ntime_int = int(job_ntime, 16) if isinstance(job_ntime, str) else int(job_ntime)
                    current_time = max(job_ntime_int, int(time.time()))
                except:
                    current_time = int(time.time())
            else:
                current_time = int(time.time())
            ntime_bytes = pack_i("<I", current_time)
            
            # Pre-allocate bytearray for header (reuse across iterations)
            header_buf = bytearray(80)  # Bitcoin header is 80 bytes
            
            # Build static header parts (version + prevhash + nbits) - only once per batch
            header_buf[0:4] = version_bytes
            header_buf[4:36] = prevhash_bytes
            header_buf[68:72] = nbits_bytes
            header_buf[72:76] = ntime_bytes
            
            # Precompute coinbase template (coinb1 + extranonce1 + coinb2)
            # We'll insert extranonce2 in the middle
            coinbase_template_start = coinb1_bytes + extranonce1_bytes
            coinbase_template_end = coinb2_bytes
            coinbase_template_len = len(coinbase_template_start) + extranonce2_size + len(coinbase_template_end)
            
            # Preallocate coinbase buffer (reuse across iterations)
            coinbase_buf = bytearray(coinbase_template_len)
            coinbase_buf[:len(coinbase_template_start)] = coinbase_template_start
            coinbase_buf[len(coinbase_template_start)+extranonce2_size:] = coinbase_template_end
            
            # Ultra-optimized inner loop (no GIL blocking, minimal allocations!)
            batch_start_time = time.time()
            for _ in range(batch_size):
                # Build extranonce2 (little-endian, size from pool - can be 4 or 8 bytes)
                if extranonce2_size == 8:
                    # Use 64-bit packing for 8-byte extranonce2
                    struct.pack_into("<Q", coinbase_buf, len(coinbase_template_start), nonce & 0xFFFFFFFFFFFFFFFF)
                else:
                    # Use 32-bit packing for 4-byte extranonce2 (default)
                    struct.pack_into("<I", coinbase_buf, len(coinbase_template_start), nonce & nonce_mask)
                
                # Compute coinbase hash (double SHA256) - using optimized backend
                coinbase_hash = sha256d(bytes(coinbase_buf))
                
                # Compute merkle root from coinbase_hash + merkle_branches
                # Each branch is combined with current hash: dSHA256(left || right)
                merkle_root = coinbase_hash
                for branch_bytes in merkle_branches_bytes:
                    merkle_root = sha256d(merkle_root + branch_bytes)
                
                # Build complete header - only mutate merkle root and nonce
                merkle_root_bytes = merkle_root[::-1]  # Reverse for little-endian
                header_buf[36:68] = merkle_root_bytes
                header_buf[76:80] = pack_i("<I", nonce)
                
                # Double SHA-256 of header - using optimized backend
                hash2 = sha256d(bytes(header_buf))
                
                # Convert hash to integer for comparison with target
                # Bitcoin compares hashes as BIG-ENDIAN integers
                hash_int = from_bytes(hash2, byteorder="big")
                
                # Debug: log first few hash checks ONCE per job (outside hot loop, only first iteration)
                if debug_mode and debug_hash_count < 10 and loop_count < 10:
                    import sys
                    ratio = hash_int / target if target > 0 else 0
                    hash_order = len(str(hash_int))
                    target_order = len(str(target))
                    debug_msg = f"[DEBUG Worker {worker_id}] Hash check #{loop_count}:\n"
                    debug_msg += f"  Raw hash bytes (hex): {hash2.hex()}\n"
                    debug_msg += f"  Hash as int (big-endian): {hash_int}\n"
                    debug_msg += f"  Target as int (big-endian): {target}\n"
                    debug_msg += f"  Hash < target: {hash_int < target}\n"
                    debug_msg += f"  Hash/target ratio: {ratio:.2e} (hash is {ratio*100:.1f}% of target)\n"
                    debug_msg += f"  Hash order of magnitude: 10^{hash_order-1}, Target: 10^{target_order-1}\n"
                    sys.stdout.write(debug_msg)
                    sys.stdout.flush()
                    debug_hash_count += 1
                
                if hash_int < target:
                    # Found a share! Submit via queue (main process will handle it)
                    if debug_mode:
                        print(f"[DEBUG Worker {worker_id}] ✓ SHARE FOUND! job_id={job_id}, hash={hash2.hex()[:16]}..., target={hex(target)[:20]}...")
                    try:
                        # Convert extranonce2 to hex (must match extranonce2_size)
                        if extranonce2_size == 8:
                            extranonce2_bytes = struct.pack("<Q", nonce & 0xFFFFFFFFFFFFFFFF)
                        else:
                            extranonce2_bytes = pack_i("<I", nonce & nonce_mask)
                        extranonce2_hex = extranonce2_bytes.hex()
                        share_queue.put((job_id, extranonce2_hex, ntime_bytes.hex(), nonce), block=False)
                        if debug_mode:
                            print(f"[DEBUG Worker {worker_id}] Share queued: extranonce2={extranonce2_hex}, ntime={ntime_bytes.hex()}, nonce={nonce}")
                    except Exception as e:
                        if debug_mode:
                            print(f"[DEBUG Worker {worker_id}] Failed to queue share: {e}")
                        pass  # Queue full, skip this share
                
                # Increment local counter (64-bit unsigned)
                local_hash_count += 1
                loop_count += 1
                nonce += 1
                
                # Wrap nonce if needed
                if nonce >= nonce_end:
                    nonce = nonce_start
            
            batch_time = time.time() - batch_start_time
            
            # Update shared memory less frequently (every batch) - use 64-bit unsigned
            lock_start = time.time()
            with shared_total_hashes.get_lock():
                lock_wait = time.time() - lock_start
                # Ensure we don't overflow by checking current value
                current = shared_total_hashes.value
                if current + batch_size < 2**63:  # Stay within signed 64-bit range for multiprocessing
                    shared_total_hashes.value += batch_size
                else:
                    # Wrap around safely (shouldn't happen in practice, but handle it)
                    shared_total_hashes.value = (current + batch_size) % (2**63 - 1)
            
            batch_count += 1
            last_batch_time = time.time()
            
            # Profile mode: log batch performance
            if PROFILE_MODE and (batch_count <= 5 or batch_count % 100 == 0):
                batch_hps = batch_size / batch_time if batch_time > 0 else 0
                print(f"[PROFILE Worker {worker_id}] Batch {batch_count}: {batch_hps:.0f} H/s, time={batch_time:.3f}s")
            
            # #region agent log
            if batch_count <= 5 or batch_count % 100 == 0:  # Log first 5 batches, then every 100th
                try:
                    batch_hps = batch_size / batch_time if batch_time > 0 else 0
                    with open(log_path, "a") as f:
                        f.write(json.dumps({"sessionId":"debug-session","runId":"perf-debug","hypothesisId":"D","location":"mine_worker_process:batch_complete","message":"Batch completed","data":{"worker_id":worker_id,"batch_num":batch_count,"batch_size":batch_size,"batch_time_sec":batch_time,"hashes_per_sec":batch_hps,"lock_wait_sec":lock_wait,"local_hash_count":local_hash_count},"timestamp":int(time.time()*1000)}) + "\n")
                except: pass
            # #endregion
            
            # Update time occasionally (every 10 batches = ~1M hashes)
            if loop_count % (batch_size * 10) == 0:
                current_time = int(time.time())
                ntime_bytes = pack_i("<I", current_time)
        except Exception as e:
            print(f"Worker {worker_id} error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(0.1)
            continue


class StratumMiner:
    """A complete Stratum protocol Bitcoin miner in Python"""
    
    def __init__(self):
        self.running = False
        self.socket: Optional[socket.socket] = None
        self.total_hashes = 0  # 64-bit unsigned (Python int is arbitrary precision)
        self.start_time: Optional[datetime] = None
        self.shares_accepted = 0
        self.shares_rejected = 0
        self.shares_submitted = 0
        self.current_job: Optional[Dict[str, Any]] = None
        self.difficulty = 1.0  # Default difficulty (will be updated by mining.set_difficulty)
        self.extranonce1 = ""
        self.extranonce2_size = 4  # Default, will be updated by subscribe response
        self.submit_id = 3
        self.mining_threads = []
        self.mining_processes = []
        
        # Shared memory for multiprocessing (bypasses GIL)
        # Use 'q' (signed long long) for 64-bit, but treat as unsigned
        # Python multiprocessing doesn't support unsigned types directly
        self.manager = multiprocessing.Manager()
        self.shared_total_hashes = multiprocessing.Value('q', 0)  # 64-bit signed (treat as unsigned)
        self.shared_running = multiprocessing.Value('b', True)  # Boolean shared value
        self.shared_job = self.manager.dict()  # Shared dict for job data
        self.share_queue = self.manager.Queue()  # Queue for share submission
    
    def connect(self) -> bool:
        """Connect to Stratum pool"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(30)
            self.socket.connect((STRATUM_HOST, STRATUM_PORT))
            if DEBUG_STRATUM:
                print(f"[DEBUG] ✓ Connected to {STRATUM_HOST}:{STRATUM_PORT}")
            else:
                print(f"✓ Connected to {STRATUM_HOST}:{STRATUM_PORT}")
            return True
        except Exception as e:
            print(f"✗ Connection error: {e}")
            return False
    
    def send_message(self, msg: Dict[str, Any]) -> None:
        """Send JSON message to pool"""
        if self.socket:
            try:
                data = json.dumps(msg) + "\n"
                if DEBUG_STRATUM:
                    print(f"[DEBUG] → SEND: {data.strip()}")
                self.socket.send(data.encode())
            except Exception as e:
                print(f"Error sending message: {e}")
    
    def receive_message(self) -> Optional[Dict[str, Any]]:
        """Receive JSON message from pool"""
        if not self.socket:
            return None
        
        try:
            # Read until we get a complete line
            buffer = b""
            while b"\n" not in buffer:
                chunk = self.socket.recv(4096)
                if not chunk:
                    return None
                buffer += chunk
            
            # Parse JSON from buffer
            line = buffer.split(b"\n", 1)[0].decode().strip()
            if line:
                msg = json.loads(line)
                if DEBUG_STRATUM:
                    print(f"[DEBUG] ← RECV: {line}")
                return msg
        except json.JSONDecodeError:
            pass
        except socket.timeout:
            pass
        except Exception as e:
            print(f"Error receiving message: {e}")
        
        return None
    
    def double_sha256(self, data: bytes) -> bytes:
        """Compute double SHA256 hash"""
        return hashlib.sha256(hashlib.sha256(data).digest()).digest()
    
    def reverse_bytes(self, data: bytes) -> bytes:
        """Reverse byte order (little-endian to big-endian) - optimized"""
        return data[::-1]  # Faster than bytes(reversed(data))
    
    def compute_merkle_root(self, coinbase: bytes, merkle_branches: list) -> bytes:
        """Compute Merkle root from coinbase and branches"""
        root = coinbase
        for branch in merkle_branches:
            root = self.double_sha256(root + bytes.fromhex(branch))
        return root
    
    def build_block_header(self, job: Dict[str, Any], extranonce2: bytes, ntime: bytes, nonce: int) -> bytes:
        """Build Bitcoin block header"""
        # Version comes as hex string from Stratum, convert to int
        version_str = job.get("version", "20000000")
        if isinstance(version_str, str):
            version_int = int(version_str, 16) if version_str.startswith(('0x', '0X')) or all(c in '0123456789abcdefABCDEF' for c in version_str) else int(version_str)
        else:
            version_int = version_str
        version = struct.pack("<I", version_int)
        
        prevhash = bytes.fromhex(job["prevhash"])[::-1]  # Reverse for little-endian
        merkle_root = bytes.fromhex(job["merkle_root"])[::-1]
        nbits = bytes.fromhex(job["nbits"])[::-1]
        
        # Build header: version + prevhash + merkle_root + ntime + nbits + nonce
        header = version + prevhash + merkle_root + ntime + nbits + struct.pack("<I", nonce)
        return header
    
    def build_static_header(self, job: Dict[str, Any]) -> bytes:
        """Build static parts of block header (version + prevhash + merkle_root + nbits) - optimized"""
        # Version comes as hex string from Stratum, convert to int
        version_str = job.get("version", "20000000")
        if isinstance(version_str, str):
            version_int = int(version_str, 16) if version_str.startswith(('0x', '0X')) or all(c in '0123456789abcdefABCDEF' for c in version_str) else int(version_str)
        else:
            version_int = version_str
        version = struct.pack("<I", version_int)
        
        # Pre-compute hex conversions (cache these)
        prevhash_hex = job["prevhash"]
        merkle_root_hex = job["merkle_root"]
        nbits_hex = job["nbits"]
        
        # Use bytearray for faster concatenation
        header = bytearray(80)
        header[0:4] = version
        header[4:36] = bytes.fromhex(prevhash_hex)[::-1]  # Reverse for little-endian
        header[36:68] = bytes.fromhex(merkle_root_hex)[::-1]
        header[68:72] = bytes.fromhex(nbits_hex)[::-1]
        
        # Return static parts: version + prevhash + merkle_root + nbits (first 72 bytes)
        return bytes(header[:72])
    
    def check_share(self, header: bytes, target: int) -> bool:
        """Check if share meets target difficulty"""
        hash_result = self.reverse_bytes(self.double_sha256(header))
        hash_int = int.from_bytes(hash_result, byteorder="big")
        return hash_int < target
    
    def submit_share(self, job_id: str, extranonce2_hex: str, ntime_hex: str, nonce: int):
        """Submit a share to the pool"""
        submit_id = self.submit_id
        self.submit_id += 1
        self.shares_submitted += 1
        
        # Convert nonce to hex (little-endian, 8 hex chars)
        nonce_hex = struct.pack("<I", nonce).hex()
        
        if DEBUG_STRATUM:
            print(f"[DEBUG] Submitting share: job_id={job_id}, extranonce2={extranonce2_hex}, ntime={ntime_hex}, nonce={nonce_hex}")
        
        self.send_message({
            "id": submit_id,
            "method": "mining.submit",
            "params": [
                BTC_WALLET + "." + WORKER_NAME,
                job_id,
                extranonce2_hex,
                ntime_hex,
                nonce_hex
            ]
        })
    
    def handle_message(self, msg: Dict[str, Any]) -> None:
        """Handle messages from pool"""
        method = msg.get("method")
        result = msg.get("result")
        error = msg.get("error")
        msg_id = msg.get("id")
        params = msg.get("params", [])
        
        if method == "mining.notify":
            # New job notification
            if len(params) >= 9:
                job_id = params[0]
                prevhash = params[1]
                coinb1 = params[2]
                coinb2 = params[3]
                merkle_branches = params[4]
                version = params[5]
                nbits = params[6]
                ntime = params[7]
                clean_jobs = params[8]
                
                if DEBUG_STRATUM:
                    print(f"[DEBUG] mining.notify: job_id={job_id}, clean_jobs={clean_jobs}")
                
                # Build job object (merkle_root will be computed per share with extranonce2)
                self.current_job = {
                    "job_id": job_id,
                    "prevhash": prevhash,
                    "coinb1": coinb1,
                    "coinb2": coinb2,
                    "merkle_branches": merkle_branches if isinstance(merkle_branches, list) else [],
                    "version": version,
                    "nbits": nbits,
                    "ntime": ntime,
                }
                
                # Calculate target from difficulty (target = max_target / difficulty)
                # Max target for Bitcoin: 0x00000000FFFF0000000000000000000000000000000000000000000000000000
                max_target = 0x00000000FFFF0000000000000000000000000000000000000000000000000000
                # Use difficulty, default to 1.0 if not set yet
                current_diff = float(self.difficulty) if self.difficulty > 0 else 1.0
                target = int(max_target // current_diff)
                
                if DEBUG_STRATUM:
                    print(f"[DEBUG] Job {job_id}: difficulty={current_diff}, max_target={hex(max_target)}, target={hex(target)}, target_int={target}")
                    # Verify target calculation
                    if current_diff == 1.0:
                        print(f"[DEBUG] For difficulty 1.0, target should equal max_target: {target == max_target}")
                
                # Update shared_job for worker processes
                self.shared_job.update({
                    "job_id": job_id,
                    "prevhash": prevhash,
                    "coinb1": coinb1,
                    "coinb2": coinb2,
                    "extranonce1": self.extranonce1,
                    "merkle_branches": merkle_branches if isinstance(merkle_branches, list) else [],
                    "version": version,
                    "nbits": nbits,
                    "ntime": ntime,  # Include ntime from job
                    "target": target,
                    "extranonce2_size": self.extranonce2_size
                })
                
                print(f"[{datetime.now().strftime('%H:%M:%S')}] New job: {job_id}")
        
        elif method == "mining.set_difficulty":
            # Difficulty change
            if params:
                self.difficulty = float(params[0])
                if DEBUG_STRATUM:
                    print(f"[DEBUG] mining.set_difficulty: {self.difficulty}")
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Difficulty: {self.difficulty}")
                
                # Recalculate target and update shared_job
                max_target = 0x00000000FFFF0000000000000000000000000000000000000000000000000000
                target = int(max_target // self.difficulty) if self.difficulty > 0 else max_target
                self.shared_job["target"] = target
                if DEBUG_STRATUM:
                    print(f"[DEBUG] Updated target: {hex(target)[:20]}...")
        
        elif result is not None:
            # Handle responses
            if msg_id == 1:  # Subscribe response
                if isinstance(result, list) and len(result) >= 2:
                    self.extranonce1 = result[1] if isinstance(result[1], str) else ""
                    self.extranonce2_size = result[2] if len(result) >= 3 else 4
                    if DEBUG_STRATUM:
                        print(f"[DEBUG] mining.subscribe response: extranonce1={self.extranonce1}, extranonce2_size={self.extranonce2_size}")
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ Subscribed (extranonce1: {self.extranonce1[:16]}...)")
            
            elif msg_id == 2:  # Authorization response
                if result:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ Authorized")
                else:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✗ Authorization failed")
                    self.running = False
            
            elif msg_id and msg_id >= 3:  # Submit response
                if result:
                    self.shares_accepted += 1
                    if DEBUG_STRATUM:
                        print(f"[DEBUG] Share ACCEPTED (ID: {msg_id})")
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ Share accepted (Total: {self.shares_accepted})")
                else:
                    self.shares_rejected += 1
                    error_msg = error[1] if error and len(error) > 1 else "Unknown error"
                    if DEBUG_STRATUM:
                        print(f"[DEBUG] Share REJECTED (ID: {msg_id}): {error_msg}")
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✗ Share rejected: {error_msg} (Total rejected: {self.shares_rejected})")
        
        elif error:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Error: {error}")
    
    def start(self, num_threads: int = 1) -> bool:
        """Start mining"""
        if not self.connect():
            return False
        
        self.running = True
        self.start_time = datetime.now()
        
        # Subscribe
        self.send_message({
            "id": 1,
            "method": "mining.subscribe",
            "params": []
        })
        
        # Wait for subscribe response
        time.sleep(0.5)
        
        # Authorize
        self.send_message({
            "id": 2,
            "method": "mining.authorize",
            "params": [BTC_WALLET + "." + WORKER_NAME, "x"]
        })
        
        print("=" * 60)
        print("Minr.online Python Stratum Miner")
        print("=" * 60)
        print(f"Worker: {WORKER_NAME}")
        print(f"Wallet: {BTC_WALLET}")
        print(f"Pool: {STRATUM_HOST}:{STRATUM_PORT}")
        print(f"Threads: {num_threads}")
        if DEBUG_STRATUM:
            print("Debug mode: ON")
        if TEST_LOW_DIFF:
            print("Test mode: Low difficulty")
        print("=" * 60)
        
        # Start message receiver thread
        def receiver_thread():
            while self.running:
                try:
                    msg = self.receive_message()
                    if msg:
                        self.handle_message(msg)
                except Exception as e:
                    if self.running:
                        print(f"Receiver error: {e}")
                    break
        
        receiver = threading.Thread(target=receiver_thread, daemon=True)
        receiver.start()
        
        # Wait for first job
        while self.running and not self.current_job:
            time.sleep(0.1)
        
        # Start mining processes (multiprocessing bypasses GIL for TRUE parallelism)
        # This gives us real CPU parallelism, not just concurrency
        # Use standalone function (not method) to avoid pickling issues
        # #region agent log
        import os
        log_path = "/Users/seneca/Desktop/minr.online/.cursor/debug.log"
        try:
            with open(log_path, "a") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"perf-debug","hypothesisId":"E","location":"StratumMiner.start:workers_start","message":"Starting workers","data":{"num_threads":num_threads,"cpu_count":multiprocessing.cpu_count()},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        for i in range(num_threads):
            process = multiprocessing.Process(
                target=mine_worker_process,
                args=(i, self.shared_total_hashes, self.shared_running, self.shared_job, self.share_queue, DEBUG_STRATUM),
                daemon=True
            )
            process.start()
            self.mining_processes.append(process)
            # #region agent log
            try:
                with open(log_path, "a") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"perf-debug","hypothesisId":"E","location":"StratumMiner.start:worker_started","message":"Worker process started","data":{"worker_id":i,"pid":process.pid,"is_alive":process.is_alive()},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
        
        # Start share processor thread (processes shares from queue)
        def process_shares():
            while self.running:
                try:
                    share_data = self.share_queue.get(timeout=0.1)
                    if share_data:
                        job_id, extranonce2_hex, ntime_hex, nonce = share_data
                        self.submit_share(job_id, extranonce2_hex, ntime_hex, nonce)
                except:
                    pass
        
        share_processor = threading.Thread(target=process_shares, daemon=True)
        share_processor.start()
        
        # Print stats periodically and report to API
        def print_and_report_stats():
            import urllib.request
            import urllib.error
            
            last_total_hashes = 0  # Track for hashrate calculation (64-bit unsigned)
            last_check_time = None  # Track last check time for accurate hashrate
            log_path = "/Users/seneca/Desktop/minr.online/.cursor/debug.log"
            
            while self.running:
                time.sleep(10)
                if self.start_time:
                    current_check_time = datetime.now()
                    
                    # Get total hashes from shared memory (64-bit unsigned)
                    with self.shared_total_hashes.get_lock():
                        total_hashes = self.shared_total_hashes.value
                        # Handle signed 64-bit as unsigned
                        if total_hashes < 0:
                            total_hashes = total_hashes + 2**64
                    
                    self.total_hashes = total_hashes  # Update instance for compatibility
                    
                    duration = (current_check_time - self.start_time).total_seconds()
                    
                    # Calculate hashrate using unsigned delta
                    delta = total_hashes - last_total_hashes
                    if delta < 0:
                        delta = delta + 2**64  # Handle wrap-around
                    
                    # Calculate hashrate: delta over the actual time elapsed since last check
                    # This prevents showing 0.00 H/s when workers are actively mining
                    if last_check_time is not None:
                        actual_elapsed = (current_check_time - last_check_time).total_seconds()
                        if actual_elapsed > 0:
                            hashrate = delta / actual_elapsed
                        else:
                            hashrate = 0.0
                    else:
                        # First check: use duration since start (but at least 1 second to avoid division by zero)
                        hashrate = delta / max(duration, 1.0) if duration > 0 else 0.0
                    
                    last_check_time = current_check_time
                    
                    # #region agent log
                    try:
                        with open(log_path, "a") as f:
                            f.write(json.dumps({"sessionId":"debug-session","runId":"perf-debug","hypothesisId":"F","location":"print_and_report_stats:hashrate_calc","message":"Hashrate calculated","data":{"total_hashes":total_hashes,"last_total_hashes":last_total_hashes,"delta":delta,"hashrate":hashrate,"duration_sec":duration,"num_workers":len(self.mining_processes),"workers_alive":sum(1 for p in self.mining_processes if p.is_alive())},"timestamp":int(time.time()*1000)}) + "\n")
                    except: pass
                    # #endregion
                    
                    last_total_hashes = total_hashes
                    
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Hashrate: {hashrate:.2f} H/s | "
                          f"Accepted: {self.shares_accepted} | Rejected: {self.shares_rejected} | "
                          f"Submitted: {self.shares_submitted} | Total hashes: {self.total_hashes:,}")
                    
                    # Report stats to API (try even without AUTH_TOKEN - endpoint will find user by workerName)
                    if API_URL:
                        try:
                            stats_data = {
                                "totalHashes": self.total_hashes,
                                "hashesPerSecond": hashrate,
                                "acceptedShares": self.shares_accepted,
                                "rejectedShares": self.shares_rejected,
                                "workerName": WORKER_NAME
                            }
                            
                            headers = {
                                'Content-Type': 'application/json'
                            }
                            # Add auth token if available
                            if AUTH_TOKEN:
                                headers['Authorization'] = f'Bearer {AUTH_TOKEN}'
                            
                            req = urllib.request.Request(
                                f"{API_URL}/api/miner-stats",
                                data=json.dumps(stats_data).encode('utf-8'),
                                headers=headers,
                                method='POST'
                            )
                            
                            with urllib.request.urlopen(req, timeout=5) as response:
                                pass  # Stats reported successfully
                        except Exception as e:
                            # Log error but don't interrupt mining
                            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠ Stats reporting error: {type(e).__name__}: {str(e)[:100]}")
        
        stats_thread = threading.Thread(target=print_and_report_stats, daemon=True)
        stats_thread.start()
        
        # Keep main thread alive
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()
        
        return True
    
    def stop(self) -> None:
        """Stop mining"""
        self.running = False
        self.shared_running.value = False  # Signal processes to stop
        
        # Wait for processes to finish
        for process in self.mining_processes:
            process.join(timeout=2)
            if process.is_alive():
                process.terminate()
        
        if self.socket:
            self.socket.close()
        
        if self.start_time:
            duration = (datetime.now() - self.start_time).total_seconds()
            print("\n" + "=" * 60)
            print("Mining Stopped")
            print("=" * 60)
            print(f"Duration: {duration:.0f} seconds")
            print(f"Total Hashes: {self.total_hashes:,}")
            print(f"Hashrate: {self.total_hashes / duration:.2f} H/s" if duration > 0 else "Hashrate: 0 H/s")
            print(f"Shares Submitted: {self.shares_submitted}")
            print(f"Shares Accepted: {self.shares_accepted}")
            print(f"Shares Rejected: {self.shares_rejected}")
            print("=" * 60)


def main():
    """Main entry point"""
    import multiprocessing
    
    global DEBUG_STRATUM, TEST_LOW_DIFF, BENCH_MODE, PROFILE_MODE
    
    # Parse command line arguments
    num_threads = multiprocessing.cpu_count()
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg == "--debug-stratum":
                DEBUG_STRATUM = True
            elif arg == "--test-low-diff":
                TEST_LOW_DIFF = True
            elif arg == "--bench":
                BENCH_MODE = True
            elif arg == "--profile":
                PROFILE_MODE = True
            elif arg == "--cli":
                num_threads = multiprocessing.cpu_count()
            else:
                try:
                    num_threads = int(arg)
                except ValueError:
                    print(f"Usage: {sys.argv[0]} [num_threads] [--debug-stratum] [--test-low-diff] [--bench] [--profile]")
                    print(f"       {sys.argv[0]} --cli  # Use all CPU cores")
                    print(f"       {sys.argv[0]} --bench  # Benchmark mode (no Stratum)")
                    print(f"       {sys.argv[0]} --profile  # Profile mode (show performance stats)")
                    sys.exit(1)
    else:
        num_threads = multiprocessing.cpu_count()
    
    # Benchmark mode: test hashing performance without Stratum
    if BENCH_MODE:
        run_benchmark(num_threads)
        return
    
    miner = StratumMiner()
    
    try:
        miner.start(num_threads)
    except KeyboardInterrupt:
        miner.stop()
    except Exception as e:
        print(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        miner.stop()
        sys.exit(1)


if __name__ == "__main__":
    main()
