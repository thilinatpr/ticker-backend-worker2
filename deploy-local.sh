#!/bin/bash

echo "🚀 Local Cloudflare Worker Deployment Script"
echo "============================================="

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo "❌ wrangler.toml not found. Please run this from the worker directory."
    exit 1
fi

echo ""
echo "📋 This script will help you deploy the Cloudflare Worker with Queue support."
echo ""

# Check authentication method
echo "🔐 Choose authentication method:"
echo "1. API Token (Recommended)"
echo "2. Global API Key + Email"
echo ""
read -p "Enter choice (1 or 2): " auth_choice

if [ "$auth_choice" = "1" ]; then
    echo ""
    echo "📝 To get an API Token:"
    echo "1. Go to: https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Click 'Create Token' → 'Custom token'"
    echo "3. Add permissions: Account:Cloudflare Workers:Edit, Account:Account Settings:Read"
    echo "4. Copy the token"
    echo ""
    read -p "Enter your API Token: " api_token
    export CLOUDFLARE_API_TOKEN="$api_token"
    
elif [ "$auth_choice" = "2" ]; then
    echo ""
    echo "📝 To get your Global API Key:"
    echo "1. Go to: https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Scroll to 'Global API Key' → Click 'View'"
    echo "3. Copy the key"
    echo ""
    read -p "Enter your Cloudflare email: " cf_email
    read -p "Enter your Global API Key: " api_key
    export CLOUDFLARE_EMAIL="$cf_email"
    export CLOUDFLARE_API_KEY="$api_key"
    unset CLOUDFLARE_API_TOKEN
else
    echo "❌ Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "🔍 Verifying authentication..."
if npx wrangler whoami; then
    echo "✅ Authentication successful!"
else
    echo "❌ Authentication failed. Please check your credentials."
    exit 1
fi

echo ""
echo "📦 Creating Cloudflare Queue (requires paid plan)..."
if npx wrangler queues create ticker-dividend-queue; then
    echo "✅ Queue created successfully!"
else
    echo "⚠️  Queue creation failed (might already exist). Continuing..."
fi

echo ""
echo "🚀 Deploying Cloudflare Worker..."
if npx wrangler deploy; then
    echo "✅ Worker deployed successfully!"
else
    echo "❌ Worker deployment failed."
    exit 1
fi

echo ""
echo "📋 Getting deployment information..."
npx wrangler list

echo ""
echo "🏥 Testing worker health..."
echo "Trying to detect worker URL..."

# Try to get subdomain info
SUBDOMAIN_INFO=$(npx wrangler subdomain 2>/dev/null || echo "")
if [[ $SUBDOMAIN_INFO == *"https://"* ]]; then
    WORKER_BASE_URL=$(echo "$SUBDOMAIN_INFO" | grep -o 'https://[^/]*' | head -1)
    WORKER_URL="${WORKER_BASE_URL}/health"
    
    echo "Detected worker URL: $WORKER_URL"
    
    sleep 5  # Wait for deployment to propagate
    
    if curl -f -m 10 "$WORKER_URL" 2>/dev/null; then
        echo "✅ Worker health check passed!"
        echo ""
        echo "🎉 Deployment successful!"
        echo "Worker URL: $WORKER_BASE_URL"
        echo "Health endpoint: $WORKER_URL"
    else
        echo "⚠️  Health check failed, but worker might still be deploying."
        echo "Check Cloudflare Dashboard for the actual worker URL."
    fi
else
    echo "Could not auto-detect worker URL."
    echo "Please check your Cloudflare Dashboard for the worker URL."
fi

echo ""
echo "📝 Next steps:"
echo "1. Note down your worker URL from above or Cloudflare Dashboard"
echo "2. Update the CLOUDFLARE_WORKER_QUEUE_URL in your main API environment"
echo "3. Test the queue integration with new ticker submissions"
echo ""
echo "🎯 Your worker is now deployed with:"
echo "- ✅ Cloudflare Queue support (instant ticker processing)"
echo "- ✅ Cron schedules (9 AM & 9 PM UTC for bulk updates)"
echo "- ✅ Error handling and retry logic"
echo ""
echo "Happy trading! 📈"