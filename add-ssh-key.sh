#!/bin/bash
# Script to add SSH key to server
# Run this on the SERVER (via console or another method)

echo "=========================================="
echo "Add SSH Key to Server"
echo "=========================================="
echo ""
echo "Copy your public key below and run these commands ON THE SERVER:"
echo ""
echo "mkdir -p ~/.ssh"
echo "chmod 700 ~/.ssh"
echo "echo 'YOUR_PUBLIC_KEY_HERE' >> ~/.ssh/authorized_keys"
echo "chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "Your public key:"
cat ~/.ssh/id_ed25519.pub
echo ""
echo "=========================================="

