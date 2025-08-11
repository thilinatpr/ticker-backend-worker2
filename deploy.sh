#!/bin/bash

# Deploy script for Cloudflare Worker
# Usage: ./deploy.sh [your-cloudflare-api-token]

if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh <cloudflare-api-token>"
  echo "Get your token from: https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi

export CLOUDFLARE_API_TOKEN="$1"

echo "🚀 Deploying ticker-backend-worker to Cloudflare..."
echo "📊 Using production environment configuration"

wrangler deploy --env production

if [ $? -eq 0 ]; then
  echo "✅ Deployment successful!"
  echo "🔗 Your worker is now available at: https://ticker-backend-worker.[your-subdomain].workers.dev"
  echo "📅 Cron job scheduled for daily execution at 9:00 AM UTC"
  echo ""
  echo "Next steps:"
  echo "1. Test the worker: curl https://ticker-backend-worker.[your-subdomain].workers.dev/health"
  echo "2. Monitor cron jobs in Cloudflare dashboard"
  echo "3. Check logs: wrangler tail ticker-backend-worker"
else
  echo "❌ Deployment failed. Check the logs above for details."
  exit 1
fi