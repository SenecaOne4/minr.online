# Manual Server Deployment Steps

The Python Miner Installer code is already pushed to GitHub. You need to deploy it to the server.

## Option 1: SSH with Password

If you have the server password, run these commands:

```bash
ssh root@165.227.104.79
```

Then once connected, run:

```bash
cd /var/www/minr-online
git pull origin main
cd backend
grep -c "Python Miner Installer" src/routes/cpu-miner-launcher.ts  # Should return: 3
pnpm build
pkill -9 -f 'node.*backend'
sleep 2
PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &
sleep 3
ps aux | grep '[n]ode.*backend'
tail -10 /var/log/minr-backend.log
```

## Option 2: Add SSH Key to Server

If you want to use SSH key authentication:

1. Copy your public key:
```bash
cat ~/.ssh/id_ed25519.pub
```

2. SSH to the server (with password):
```bash
ssh root@165.227.104.79
```

3. Add your public key to authorized_keys:
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

4. Then run the deployment commands above.

## After Deployment

1. **Delete ALL old HTML files** from your Downloads folder (especially `minr-cpu-miner-launcher-*.html`)
2. **Clear browser cache**:
   - Chrome: Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
   - Select "Cached images and files"
   - Click "Clear data"
3. **Download a NEW HTML file**:
   - Go to: https://minr.online/dashboard
   - Click "Download Desktop Miner"
   - Save the new HTML file
4. **Verify the new file**:
   - Open the HTML file in a text editor
   - Search for "Python Miner Installer"
   - You should see it 3 times (Mac, Linux, Windows installers)
   - If you see "cpuminer" or "Building cpuminer", it's still the old file

## Troubleshooting

If you still get the old file:
- Make sure you deleted ALL old HTML files
- Try downloading in an incognito/private window
- Check the server logs: `tail -20 /var/log/minr-backend.log`
- Verify the built file has Python Miner: `grep -r "Python Miner Installer" /var/www/minr-online/backend/dist/`

