#!/usr/bin/env python3
"""
Minr.online Miner Script Template
This file is used as a template for generating user-specific miner scripts
"""

import sys
import time
import hashlib
import json
import socket
import threading
from datetime import datetime

# Configuration (embedded at generation time)
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
        
    def connect(self):
        """Connect to Stratum pool"""
        try:
            host, port = STRATUM_ENDPOINT.split(':')
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((host, int(port)))
            print(f"Connected to {STRATUM_ENDPOINT}")
            return True
        except Exception as e:
            print(f"Connection error: {e}")
            return False
    
    def send_message(self, msg):
        """Send JSON message to pool"""
        if self.socket:
            data = json.dumps(msg) + "\n"
            self.socket.send(data.encode())
    
    def receive_message(self):
        """Receive JSON message from pool"""
        if self.socket:
            data = self.socket.recv(4096).decode()
            if data:
                return json.loads(data.strip())
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
        
        print("Mining started...")
        print(f"Worker: {WORKER_NAME}")
        print(f"Wallet: {BTC_WALLET}")
        
        # Main mining loop
        while self.running:
            try:
                msg = self.receive_message()
                if msg:
                    self.handle_message(msg)
                time.sleep(0.1)
            except Exception as e:
                print(f"Error: {e}")
                break
        
        return True
    
    def handle_message(self, msg):
        """Handle messages from pool"""
        method = msg.get("method")
        if method == "mining.notify":
            # Handle new job
            pass
        elif method == "mining.set_difficulty":
            # Handle difficulty change
            pass
    
    def stop(self):
        """Stop mining"""
        self.running = False
        if self.socket:
            self.socket.close()
        print("Mining stopped")

def main():
    miner = MinrMiner()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--cli":
        # CLI mode
        try:
            miner.start()
            while True:
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
            root.geometry("400x300")
            
            status_label = tk.Label(root, text="Stopped", font=("Arial", 14))
            status_label.pack(pady=20)
            
            hashrate_label = tk.Label(root, text="0 H/s", font=("Arial", 12))
            hashrate_label.pack()
            
            def start_mining():
                status_label.config(text="Starting...")
                threading.Thread(target=miner.start, daemon=True).start()
                status_label.config(text="Running")
            
            def stop_mining():
                miner.stop()
                status_label.config(text="Stopped")
            
            start_btn = tk.Button(root, text="Start Mining", command=start_mining, width=20)
            start_btn.pack(pady=10)
            
            stop_btn = tk.Button(root, text="Stop Mining", command=stop_mining, width=20)
            stop_btn.pack(pady=10)
            
            root.mainloop()
        except ImportError:
            print("GUI mode requires tkinter. Use --cli flag for command-line mode.")
            miner.start()
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                miner.stop()

if __name__ == "__main__":
    main()

