#!/usr/bin/env python3
import subprocess
import time
import sys
import os

# Parse command: first arg is the script, rest are arguments
if len(sys.argv) < 2:
    print("Usage: test_stratum.py <command> [args...]")
    sys.exit(1)
    
# Split the command string if it's a single string, otherwise use as-is
if len(sys.argv) == 2 and ' ' in sys.argv[1]:
    cmd = sys.argv[1].split()
else:
    cmd = sys.argv[1:]

# Expand ~ in paths
cmd = [os.path.expanduser(arg) if arg.startswith('~') else arg for arg in cmd]
duration = 120

proc = subprocess.Popen(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

start = time.time()
output_lines = []

try:
    while time.time() - start < duration:
        line = proc.stdout.readline()
        if line:
            output_lines.append(line)
            print(line, end='')
        if not line and proc.poll() is not None:
            break
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except:
        proc.kill()
        proc.wait()

# Print final lines
print("\n" + "="*60)
print("FINAL OUTPUT (last 30 lines):")
print("="*60)
for line in output_lines[-30:]:
    print(line, end='')

