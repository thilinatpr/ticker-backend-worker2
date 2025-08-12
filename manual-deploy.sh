#!/bin/bash

echo "🚀 Manual Cloudflare Workers Deployment with Queue Support"
echo "=========================================================="

# Check if we have authentication
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ CLOUDFLARE_API_TOKEN environment variable is not set"
    echo "Please set your API token first:"
    echo "export CLOUDFLARE_API_TOKEN=\"your-token-here\""
    exit 1
fi

echo "✅ API Token found"

# Step 1: Create queue (with paid plan this should work)
echo ""
echo "📦 Creating Cloudflare Queue..."
echo "Command: npx wrangler queues create ticker-dividend-queue"

if npx wrangler queues create ticker-dividend-queue; then
    echo "✅ Queue created successfully"
else
    echo "⚠️  Queue creation failed or already exists, continuing..."
fi

# Step 2: Deploy worker
echo ""
echo "🚀 Deploying Cloudflare Worker..."
echo "Command: npx wrangler deploy"

if npx wrangler deploy; then
    echo "✅ Worker deployed successfully!"
    
    # Step 3: Get deployment info
    echo ""
    echo "📋 Deployment Information:"
    npx wrangler whoami
    
    # Step 4: Test health endpoint
    echo ""
    echo "🏥 Testing Worker Health..."
    
    # Get the worker URL from wrangler
    WORKER_URL=$(npx wrangler subdomain 2>/dev/null | grep -o 'https://[^/]*' || echo "")
    
    if [ ! -z "$WORKER_URL" ]; then
        echo "Testing: $WORKER_URL/health"
        if curl -f "$WORKER_URL/health"; then
            echo ""
            echo "✅ Worker is healthy!"
        else
            echo ""
            echo "⚠️  Health check failed, but worker might still be deploying..."
        fi
    else
        echo "Could not determine worker URL automatically"
        echo "Please check Cloudflare dashboard for your worker URL"
    fi
    
    echo ""
    echo "🎉 Deployment completed!"
    echo "Check your Cloudflare Dashboard for the worker URL and queue status"
    
else
    echo "❌ Worker deployment failed"
    echo "Check the error messages above for details"
    exit 1
fi