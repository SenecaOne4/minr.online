# Manual Server Deployment Steps

Since SSH commands aren't working, run these commands **directly on the server**:

## Step 1: Pull Latest Code
```bash
cd /var/www/minr-online
git pull origin main
```

## Step 2: Verify Source Has New Code
```bash
cd backend
grep -c "Python Miner Installer" src/routes/cpu-miner-launcher.ts
```
Should return: `3` (one for Mac, Linux, Windows)

## Step 3: Rebuild Backend
```bash
cd /var/www/minr-online/backend
pnpm build
```

## Step 4: Verify Build Contains New Code
```bash
find dist -type f -name "*.js" -exec grep -l "Python Miner Installer" {} \;
```
Should find at least one file.

## Step 5: Restart Backend
```bash
pkill -9 -f 'node.*backend'
sleep 2
cd /var/www/minr-online/backend
PORT=3000 NODE_ENV=production nohup pnpm start > /var/log/minr-backend.log 2>&1 &
sleep 3
ps aux | grep '[n]ode.*backend'
```

## Step 6: Verify Backend is Running
```bash
tail -10 /var/log/minr-backend.log
```

## Step 7: Test the Endpoint
After restarting, download a fresh HTML launcher from your dashboard. The new file should contain "Python Miner Installer" (not "CPU Miner Installer").



