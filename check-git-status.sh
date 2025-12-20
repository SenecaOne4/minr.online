#!/bin/bash
# Check git status and diagnose push issues

cd /Users/seneca/Desktop/minr.online

echo "=== Git Status ==="
git status

echo ""
echo "=== Git Remote ==="
git remote -v

echo ""
echo "=== Recent Commits ==="
git log --oneline -5

echo ""
echo "=== Uncommitted Changes ==="
git diff --name-only

echo ""
echo "=== Staged Changes ==="
git diff --cached --name-only

echo ""
echo "=== Checking Python Miner Installer in working directory ==="
grep -c "Python Miner Installer" backend/src/routes/cpu-miner-launcher.ts

echo ""
echo "=== Checking Python Miner Installer in HEAD ==="
git show HEAD:backend/src/routes/cpu-miner-launcher.ts 2>/dev/null | grep -c "Python Miner Installer" || echo "File not in HEAD or error"

echo ""
echo "=== Attempting Push (dry-run) ==="
git push origin main --dry-run 2>&1 | head -10



