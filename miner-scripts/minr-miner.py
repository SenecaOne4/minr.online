#!/usr/bin/env python3
"""
Minr.online Desktop Miner
A pre-configured Bitcoin miner for Minr.online lottery pool

Usage:
    python minr-miner.py          # GUI mode (requires tkinter)
    python minr-miner.py --cli    # CLI mode
"""

import sys
import time
import hashlib
import json
import socket
import threading
from datetime import datetime

# Configuration - These are replaced when script is generated
USER_EMAIL = "{{USER_EMAIL}}"
BTC_WALLET = "{{BTC_WALLET}}"
STRATUM_ENDPOINT = "{{STRATUM_ENDPOINT}}"
API_URL = "{{API_URL}}"
WORKER_NAME = "{{WORKER_NAME}}"

class MinrMiner:
    def __init__(self):
        self.running = False
        self.socket = None
        self.hashes = 0
        self.start_time = None
        self.shares_accepted = 0
        self.shares_rejected = 0
        
    def connect(self):
        """Connect to Stratum pool"""
        try:
            host, port = STRATUM_ENDPOINT.split(':')
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((host, int(port)))
            print(f"✓ Connected to {STRATUM_ENDPOINT}")
            return True
        except Exception as e:
            print(f"✗ Connection error: {e}")
            return False
    
    def send_message(self, msg):
        """Send JSON message to pool"""
        if self.socket:
            data = json.dumps(msg) + "\n"
            self.socket.send(data.encode())
    
    def receive_message(self):
        """Receive JSON message from pool"""
        if self.socket:
            try:
                data = self.socket.recv(4096).decode()
                if data:
                    # Handle multiple JSON messages in one chunk
                    lines = data.strip().split('\n')
                    for line in lines:
                        if line.strip():
                            return json.loads(line.strip())
            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"Error receiving message: {e}")
        return None
    
    def start(self):
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
        
        # Authorize
        self.send_message({
            "id": 2,
            "method": "mining.authorize",
            "params": [BTC_WALLET, "x"]
        })
        
        print("=" * 60)
        print("Minr.online Miner Started")
        print("=" * 60)
        print(f"Worker: {WORKER_NAME}")
        print(f"Wallet: {BTC_WALLET}")
        print(f"Pool: {STRATUM_ENDPOINT}")
        print("=" * 60)
        
        # Main mining loop
        while self.running:
            try:
                msg = self.receive_message()
                if msg:
                    self.handle_message(msg)
                time.sleep(0.1)
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error: {e}")
                break
        
        return True
    
    def handle_message(self, msg):
        """Handle messages from pool"""
        method = msg.get("method")
        result = msg.get("result")
        error = msg.get("error")
        msg_id = msg.get("id")
        
        if method == "mining.notify":
            # Handle new job
            params = msg.get("params", [])
            if len(params) >= 9:
                job_id = params[0]
                print(f"[{datetime.now().strftime('%H:%M:%S')}] New job: {job_id}")
        
        elif method == "mining.set_difficulty":
            # Handle difficulty change
            params = msg.get("params", [])
            if params:
                diff = params[0]
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Difficulty: {diff}")
        
        elif result is not None:
            # Handle responses
            if msg_id == 2:  # Authorization response
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
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✗ Share rejected (Total rejected: {self.shares_rejected})")
        
        elif error:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Error: {error}")
    
    def stop(self):
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
            print(f"Shares Accepted: {self.shares_accepted}")
            print(f"Shares Rejected: {self.shares_rejected}")
            print("=" * 60)

def main():
    miner = MinrMiner()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--cli":
        # CLI mode
        try:
            miner.start()
            while miner.running:
                time.sleep(1)
        except KeyboardInterrupt:
            miner.stop()
    else:
        # GUI mode (requires tkinter)
        try:
            import tkinter as tk
            from tkinter import ttk
            
            root = tk.Tk()
            root.title("Minr.online Miner")
            root.geometry("500x400")
            root.configure(bg="#1f2937")
            
            # Title
            title_label = tk.Label(
                root,
                text="Minr.online Miner",
                font=("Arial", 18, "bold"),
                bg="#1f2937",
                fg="#ffffff"
            )
            title_label.pack(pady=20)
            
            # Status
            status_label = tk.Label(
                root,
                text="Stopped",
                font=("Arial", 14),
                bg="#1f2937",
                fg="#9ca3af"
            )
            status_label.pack(pady=10)
            
            # Stats
            stats_frame = tk.Frame(root, bg="#1f2937")
            stats_frame.pack(pady=20)
            
            shares_label = tk.Label(
                stats_frame,
                text="Shares Accepted: 0",
                font=("Arial", 12),
                bg="#1f2937",
                fg="#86efac"
            )
            shares_label.pack()
            
            rejected_label = tk.Label(
                stats_frame,
                text="Shares Rejected: 0",
                font=("Arial", 12),
                bg="#1f2937",
                fg="#fca5a5"
            )
            rejected_label.pack()
            
            # Buttons
            button_frame = tk.Frame(root, bg="#1f2937")
            button_frame.pack(pady=20)
            
            def start_mining():
                status_label.config(text="Starting...", fg="#fbbf24")
                threading.Thread(target=miner.start, daemon=True).start()
                status_label.config(text="Running", fg="#86efac")
                
                # Update stats periodically
                def update_stats():
                    if miner.running:
                        shares_label.config(text=f"Shares Accepted: {miner.shares_accepted}")
                        rejected_label.config(text=f"Shares Rejected: {miner.shares_rejected}")
                        root.after(1000, update_stats)
                
                update_stats()
            
            def stop_mining():
                miner.stop()
                status_label.config(text="Stopped", fg="#9ca3af")
            
            start_btn = tk.Button(
                button_frame,
                text="Start Mining",
                command=start_mining,
                width=20,
                bg="#2563eb",
                fg="#ffffff",
                font=("Arial", 12, "bold"),
                relief=tk.FLAT,
                padx=10,
                pady=5
            )
            start_btn.pack(pady=10)
            
            stop_btn = tk.Button(
                button_frame,
                text="Stop Mining",
                command=stop_mining,
                width=20,
                bg="#dc2626",
                fg="#ffffff",
                font=("Arial", 12, "bold"),
                relief=tk.FLAT,
                padx=10,
                pady=5
            )
            stop_btn.pack(pady=10)
            
            # Info
            info_label = tk.Label(
                root,
                text=f"Worker: {WORKER_NAME}\nWallet: {BTC_WALLET[:20]}...",
                font=("Arial", 10),
                bg="#1f2937",
                fg="#9ca3af",
                justify=tk.LEFT
            )
            info_label.pack(pady=10)
            
            root.mainloop()
        except ImportError:
            print("GUI mode requires tkinter. Use --cli flag for command-line mode.")
            print("On Linux: sudo apt-get install python3-tk")
            print("On macOS: tkinter is usually included")
            print("On Windows: tkinter is included")
            miner.start()
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                miner.stop()

if __name__ == "__main__":
    main()

