#!/bin/bash
cd /var/www/minr-online/frontend && pnpm install && pnpm build && systemctl restart frontend 2>/dev/null || echo "Frontend service not found - check if Next.js is running manually" && systemctl reload nginx && echo "✓ Deployment complete - hard refresh your browser"

