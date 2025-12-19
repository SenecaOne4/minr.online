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
        """Reverse byte order (little-endian to big-endian)"""
        return bytes(reversed(data))
    
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
    
    def check_share(self, header: bytes, target: int) -> bool:
        """Check if share meets target difficulty"""
        hash_result = self.reverse_bytes(self.double_sha256(header))
        hash_int = int.from_bytes(hash_result, byteorder="big")
        return hash_int < target
    
    def mine_worker(self, worker_id: int):
        """Mining worker thread"""
        # #region agent log
        import json
        try:
            with open('/Users/seneca/Desktop/minr.online/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({
                    "timestamp": time.time() * 1000,
                    "location": "minr-stratum-miner.py:mine_worker:entry",
                    "message": "Mining worker thread started",
                    "data": {"worker_id": worker_id, "has_current_job": self.current_job is not None},
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "A"
                }) + "\n")
        except: pass
        # #endregion
        
        if not self.current_job:
            # #region agent log
            try:
                with open('/Users/seneca/Desktop/minr.online/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({
                        "timestamp": time.time() * 1000,
                        "location": "minr-stratum-miner.py:mine_worker:no_job",
                        "message": "No current job, exiting worker",
                        "data": {"worker_id": worker_id},
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "B"
                    }) + "\n")
            except: pass
            # #endregion
            return
        
        job = self.current_job
        job_id = job.get("job_id", "")
        target = job.get("target", 0x00000000FFFF0000000000000000000000000000000000000000000000000000)
        
        # Convert target from hex string to int if needed
        if isinstance(target, str):
            target = int(target, 16)
        
        # Mining loop
        nonce = worker_id * 0x1000000  # Each thread gets a range
        max_nonce = (worker_id + 1) * 0x1000000
        
        # #region agent log
        try:
            with open('/Users/seneca/Desktop/minr.online/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({
                    "timestamp": time.time() * 1000,
                    "location": "minr-stratum-miner.py:mine_worker:loop_start",
                    "message": "Entering mining loop",
                    "data": {"worker_id": worker_id, "job_id": job_id, "nonce_start": nonce, "max_nonce": max_nonce, "running": self.running},
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "C"
                }) + "\n")
        except: pass
        # #endregion
        
        loop_count = 0
        # Main mining loop - restart when new jobs arrive
        while self.running:
            # Get current job (may change during mining)
            current_job = self.current_job
            if not current_job:
                time.sleep(0.1)  # Wait for job
                continue
            
            # Update job info if it changed
            current_job_id = current_job.get("job_id", "")
            if current_job_id != job_id:
                job_id = current_job_id
                job = current_job
                target = job.get("target", 0x00000000FFFF0000000000000000000000000000000000000000000000000000)
                if isinstance(target, str):
                    target = int(target, 16)
                # Reset nonce range for new job
                nonce = worker_id * 0x1000000
                max_nonce = (worker_id + 1) * 0x1000000
            
            try:
                # Build extranonce2 (4 bytes, little-endian)
                extranonce2 = struct.pack("<I", nonce & 0xFFFFFFFF)
                
                # Build ntime (current time, 4 bytes, little-endian)
                ntime = struct.pack("<I", int(time.time()))
                
                # Build block header
                header = self.build_block_header(job, extranonce2, ntime, nonce)
                
                # Check if share meets target
                if self.check_share(header, target):
                    # Found a share!
                    self.submit_share(job_id, extranonce2, ntime, nonce)
                
                self.total_hashes += 1
                loop_count += 1
                
                # Increment nonce
                nonce += 1
                if nonce >= max_nonce:
                    nonce = worker_id * 0x1000000  # Wrap around
                
                # Small sleep to prevent 100% CPU
                if self.total_hashes % 10000 == 0:
                    time.sleep(0.001)
                    
                # #region agent log
                if loop_count == 1 or loop_count % 100000 == 0:
                    try:
                        with open('/Users/seneca/Desktop/minr.online/.cursor/debug.log', 'a') as f:
                            f.write(json.dumps({
                                "timestamp": time.time() * 1000,
                                "location": "minr-stratum-miner.py:mine_worker:loop_iteration",
                                "message": "Mining loop iteration",
                                "data": {"worker_id": worker_id, "loop_count": loop_count, "total_hashes": self.total_hashes, "nonce": nonce, "job_id": job_id},
                                "sessionId": "debug-session",
                                "runId": "run1",
                                "hypothesisId": "D"
                            }) + "\n")
                    except: pass
                # #endregion
            except Exception as e:
                # #region agent log
                try:
                    with open('/Users/seneca/Desktop/minr.online/.cursor/debug.log', 'a') as f:
                        f.write(json.dumps({
                            "timestamp": time.time() * 1000,
                            "location": "minr-stratum-miner.py:mine_worker:exception",
                            "message": "Exception in mining loop",
                            "data": {"worker_id": worker_id, "error": str(e), "error_type": type(e).__name__},
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "E"
                        }) + "\n")
                except: pass
                # #endregion
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
        
        # Start mining threads
        # #region agent log
        import json
        try:
            with open('/Users/seneca/Desktop/minr.online/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({
                    "timestamp": time.time() * 1000,
                    "location": "minr-stratum-miner.py:start:threads",
                    "message": "Starting mining threads",
                    "data": {"num_threads": num_threads, "has_current_job": self.current_job is not None},
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "F"
                }) + "\n")
        except: pass
        # #endregion
        
        for i in range(num_threads):
            thread = threading.Thread(target=self.mine_worker, args=(i,), daemon=True)
            thread.start()
            self.mining_threads.append(thread)
            
            # #region agent log
            try:
                with open('/Users/seneca/Desktop/minr.online/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({
                        "timestamp": time.time() * 1000,
                        "location": "minr-stratum-miner.py:start:thread_started",
                        "message": "Mining thread started",
                        "data": {"thread_id": i, "thread_alive": thread.is_alive()},
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "G"
                    }) + "\n")
            except: pass
            # #endregion
        
        # Print stats periodically and report to API
        def print_and_report_stats():
            import urllib.request
            import urllib.error
            
            while self.running:
                time.sleep(10)
                if self.start_time:
                    duration = (datetime.now() - self.start_time).total_seconds()
                    hashrate = self.total_hashes / duration if duration > 0 else 0
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
                            # Silently fail - don't interrupt mining
                            pass
        
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

