#!/usr/bin/env python3
"""
Minr.online Python Stratum Miner
A complete Python implementation of a Bitcoin Stratum miner.
No C dependencies - pure Python with standard library + hashlib.

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
from typing import Optional, Dict, Any

# Configuration - These are replaced when script is generated
USER_EMAIL = "{{USER_EMAIL}}"
BTC_WALLET = "{{BTC_WALLET}}"
STRATUM_HOST = "{{STRATUM_HOST}}"
STRATUM_PORT = {{STRATUM_PORT}}
WORKER_NAME = "{{WORKER_NAME}}"
API_URL = "{{API_URL}}"
AUTH_TOKEN = "{{AUTH_TOKEN}}"


class StratumMiner:
    """A complete Stratum protocol Bitcoin miner in Python"""
    
    def __init__(self):
        self.running = False
        self.socket: Optional[socket.socket] = None
        self.total_hashes = 0
        self.start_time: Optional[datetime] = None
        self.shares_accepted = 0
        self.shares_rejected = 0
        self.current_job: Optional[Dict[str, Any]] = None
        self.difficulty = 1
        self.extranonce1 = ""
        self.extranonce2_size = 0
        self.submit_id = 3
        self.mining_threads = []
        self.mining_processes = []
        
        # Shared memory for multiprocessing (bypasses GIL)
        self.manager = multiprocessing.Manager()
        self.shared_total_hashes = multiprocessing.Value('i', 0)  # Integer shared value
        self.shared_running = multiprocessing.Value('b', True)  # Boolean shared value
        self.shared_job = self.manager.dict()  # Shared dict for job data
        self.share_queue = self.manager.Queue()  # Queue for share submission
        
    def connect(self) -> bool:
        """Connect to Stratum pool"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(30)
            self.socket.connect((STRATUM_HOST, STRATUM_PORT))
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
                return json.loads(line)
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
    
    def _build_static_header_fast(self, job: Dict[str, Any]) -> bytes:
        """Fast static header builder (for multiprocessing)"""
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
        # Dynamic parts (extranonce2, ntime, nonce) will be appended in the loop
        return bytes(header[:72])
    
    def check_share(self, header: bytes, target: int) -> bool:
        """Check if share meets target difficulty"""
        hash_result = self.reverse_bytes(self.double_sha256(header))
        hash_int = int.from_bytes(hash_result, byteorder="big")
        return hash_int < target
    
    def mine_worker_process(self, worker_id: int, shared_total_hashes, shared_running, shared_job, share_queue):
        """Mining worker process (multiprocessing - bypasses GIL for true parallelism)"""
        # Wait for first job
        while shared_running.value and not shared_job:
            time.sleep(0.1)
        
        if not shared_running.value:
            return
        
        # Mining loop
        nonce = worker_id * 0x1000000  # Each process gets a range
        max_nonce = (worker_id + 1) * 0x1000000
        loop_count = 0
        
        # Cache methods locally for speed
        pack_i = struct.pack
        sha256 = hashlib.sha256
        from_bytes = int.from_bytes
        
        # Pre-compute constants
        nonce_mask = 0xFFFFFFFF
        nonce_start = worker_id * 0x1000000
        nonce_end = (worker_id + 1) * 0x1000000
        
        # Local hash counter (update shared less frequently)
        local_hash_count = 0
        # Main mining loop - restart when new jobs arrive
        job_id = ""
        target = 0x00000000FFFF0000000000000000000000000000000000000000000000000000
        static_header = None
        static_len = 0
        ntime_bytes = pack_i("<I", int(time.time()))
                
        while shared_running.value:
            # Get current job from shared memory (may change during mining)
            if not shared_job:
                time.sleep(0.01)  # Brief wait for job
                continue
            
            # Update job info if it changed
            current_job_id = shared_job.get("job_id", "")
            if current_job_id != job_id:
                job_id = current_job_id
                target = shared_job.get("target", 0x00000000FFFF0000000000000000000000000000000000000000000000000000)
                if isinstance(target, str):
                    target = int(target, 16)
                # Rebuild static header for new job (inline for multiprocessing)
                version_str = shared_job.get("version", "20000000")
                if isinstance(version_str, str):
                    version_int = int(version_str, 16) if version_str.startswith(('0x', '0X')) or all(c in '0123456789abcdefABCDEF' for c in version_str) else int(version_str)
                else:
                    version_int = version_str
                version_bytes = pack_i("<I", version_int)
                prevhash_bytes = bytes.fromhex(shared_job["prevhash"])[::-1]
                merkle_root_bytes = bytes.fromhex(shared_job["merkle_root"])[::-1]
                nbits_bytes = bytes.fromhex(shared_job["nbits"])[::-1]
                static_header = version_bytes + prevhash_bytes + merkle_root_bytes + nbits_bytes
                static_len = len(static_header)
                # Reset nonce range for new job
                nonce = nonce_start
            
            try:
                # Process HUGE batches for maximum throughput
                batch_size = 100000  # Even larger batches for processes
                current_time = int(time.time())
                ntime_bytes = pack_i("<I", current_time)
                
                # Pre-allocate bytearray for header (reuse across iterations)
                header_buf = bytearray(80)  # Bitcoin header is 80 bytes
                header_buf[:static_len] = static_header
                
                # Ultra-optimized inner loop (no GIL blocking!)
                for _ in range(batch_size):
                    # Build nonce bytes (minimal operations)
                    nonce_low = nonce & nonce_mask
                    extranonce2_bytes = pack_i("<I", nonce_low)
                    nonce_bytes = pack_i("<I", nonce)
                    
                    # Build complete header using bytearray (in-place, no allocation)
                    header_buf[static_len:static_len+4] = extranonce2_bytes
                    header_buf[static_len+4:static_len+8] = ntime_bytes
                    header_buf[static_len+8:static_len+12] = nonce_bytes
                    
                    # Double SHA-256 (inline, no function call overhead)
                    hash1 = sha256(bytes(header_buf)).digest()
                    hash2 = sha256(hash1).digest()
                    hash_int = from_bytes(hash2[::-1], byteorder="big")  # Reverse inline
                    
                    if hash_int < target:
                        # Found a share! Submit via queue (main process will handle it)
                        try:
                            share_queue.put((job_id, extranonce2_bytes, ntime_bytes, nonce), block=False)
                        except:
                            pass  # Queue full, skip this share
                    
                    # Increment local counter
                    local_hash_count += 1
                    loop_count += 1
                    nonce += 1
                    
                    # Wrap nonce if needed
                    if nonce >= nonce_end:
                        nonce = nonce_start
                
                # Update shared memory less frequently (every batch)
                with shared_total_hashes.get_lock():
                    shared_total_hashes.value += batch_size
                
                # Update time occasionally (every 10 batches = ~1M hashes)
                if loop_count % (batch_size * 10) == 0:
                    current_time = int(time.time())
                    ntime_bytes = pack_i("<I", current_time)
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Worker {worker_id} error: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(0.1)  # Brief pause before retrying
                continue  # Continue loop instead of breaking
    
    def submit_share(self, job_id: str, extranonce2: bytes, ntime: bytes, nonce: int):
        """Submit a share to the pool"""
        submit_id = self.submit_id
        self.submit_id += 1
        
        # Convert to hex strings (big-endian)
        extranonce2_hex = extranonce2.hex()
        ntime_hex = ntime.hex()
        nonce_hex = struct.pack("<I", nonce).hex()
        
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
                
                # Build job object
                self.current_job = {
                    "job_id": job_id,
                    "prevhash": prevhash,
                    "coinb1": coinb1,
                    "coinb2": coinb2,
                    "merkle_branches": merkle_branches if isinstance(merkle_branches, list) else [],
                    "version": version,
                    "nbits": nbits,
                    "ntime": ntime,
                    "merkle_root": self.compute_merkle_root(
                        bytes.fromhex(coinb1 + self.extranonce1 + coinb2),
                        merkle_branches if isinstance(merkle_branches, list) else []
                    ).hex()
                }
                
                print(f"[{datetime.now().strftime('%H:%M:%S')}] New job: {job_id}")
        
        elif method == "mining.set_difficulty":
            # Difficulty change
            if params:
                self.difficulty = params[0]
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Difficulty: {self.difficulty}")
        
        elif result is not None:
            # Handle responses
            if msg_id == 1:  # Subscribe response
                if isinstance(result, list) and len(result) >= 2:
                    self.extranonce1 = result[1] if isinstance(result[1], str) else ""
                    self.extranonce2_size = result[2] if len(result) >= 3 else 4
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
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ Share accepted (Total: {self.shares_accepted})")
                else:
                    self.shares_rejected += 1
                    error_msg = error[1] if error and len(error) > 1 else "Unknown error"
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
        for i in range(num_threads):
            process = multiprocessing.Process(
                target=self.mine_worker_process,
                args=(i, self.shared_total_hashes, self.shared_running, self.shared_job, self.share_queue),
                daemon=True
            )
            process.start()
            self.mining_processes.append(process)
        
        # Start share processor thread (processes shares from queue)
        def process_shares():
            while self.running:
                try:
                    share_data = self.share_queue.get(timeout=0.1)
                    if share_data:
                        job_id, extranonce2, ntime, nonce = share_data
                        self.submit_share(job_id, extranonce2, ntime, nonce)
                except:
                    pass
        
        share_processor = threading.Thread(target=process_shares, daemon=True)
        share_processor.start()
        
        # Print stats periodically and report to API
        def print_and_report_stats():
            import urllib.request
            import urllib.error
            
            while self.running:
                time.sleep(10)
                if self.start_time:
                    # Get total hashes from shared memory
                    with self.shared_total_hashes.get_lock():
                        total_hashes = self.shared_total_hashes.value
                    self.total_hashes = total_hashes  # Update instance for compatibility
                    
                    duration = (datetime.now() - self.start_time).total_seconds()
                    hashrate = total_hashes / duration if duration > 0 else 0
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Hashrate: {hashrate:.2f} H/s | "
                          f"Accepted: {self.shares_accepted} | Rejected: {self.shares_rejected} | "
                          f"Total hashes: {self.total_hashes:,}")
                    
                    # Report stats to API
                    if API_URL and AUTH_TOKEN:
                        try:
                            stats_data = {
                                "totalHashes": self.total_hashes,
                                "hashesPerSecond": hashrate,
                                "acceptedShares": self.shares_accepted,
                                "rejectedShares": self.shares_rejected,
                                "workerName": WORKER_NAME
                            }
                            
                            req = urllib.request.Request(
                                f"{API_URL}/api/miner-stats",
                                data=json.dumps(stats_data).encode('utf-8'),
                                headers={
                                    'Content-Type': 'application/json',
                                    'Authorization': f'Bearer {AUTH_TOKEN}'
                                },
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
            print(f"Shares Accepted: {self.shares_accepted}")
            print(f"Shares Rejected: {self.shares_rejected}")
            print("=" * 60)


def main():
    """Main entry point"""
    import multiprocessing
    
    # Get number of threads from command line or use CPU count
    num_threads = 1
    if len(sys.argv) > 1:
        try:
            num_threads = int(sys.argv[1])
        except ValueError:
            if sys.argv[1] == "--cli":
                num_threads = multiprocessing.cpu_count()
            else:
                print(f"Usage: {sys.argv[0]} [num_threads]")
                print(f"       {sys.argv[0]} --cli  # Use all CPU cores")
                sys.exit(1)
    else:
        num_threads = multiprocessing.cpu_count()
    
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

