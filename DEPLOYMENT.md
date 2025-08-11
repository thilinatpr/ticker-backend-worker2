# Cloudflare Worker Deployment Guide

## Quick Deployment

If you have your Cloudflare API token ready:

```bash
cd /root/ticker-backend/cloudflare-worker

# Method 1: Using the deploy script
./deploy.sh YOUR_CLOUDFLARE_API_TOKEN

# Method 2: Export token and deploy
export CLOUDFLARE_API_TOKEN="YOUR_CLOUDFLARE_API_TOKEN"
wrangler deploy --env production
```

## Step-by-Step Deployment

### 1. Get Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use **"Custom token"** template
4. Set permissions:
   - **Zone**: Zone Settings:Read, Zone:Read  
   - **Account**: Cloudflare Workers:Edit
5. Copy the generated token

### 2. Deploy the Worker

```bash
# Navigate to worker directory
cd /root/ticker-backend/cloudflare-worker

# Set your API token (replace with actual token)
export CLOUDFLARE_API_TOKEN="your-actual-token-here"

# Deploy to production
wrangler deploy --env production
```

### 3. Verify Deployment

After successful deployment, you'll get a worker URL like:
```
https://ticker-backend-worker.your-subdomain.workers.dev
```

Test it:
```bash
# Test health endpoint
curl https://ticker-backend-worker.your-subdomain.workers.dev/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-08-11T...",
  "service": "ticker-backend-worker"
}
```

### 4. Monitor Cron Jobs

1. Go to **Cloudflare Dashboard** → **Workers** → **ticker-backend-worker**
2. Click **"Triggers"** tab
3. Verify cron trigger is set to: `0 9 * * *` (daily at 9 AM UTC)
4. Monitor execution logs in the **"Logs"** tab

### 5. Test Cron Job Manually

```bash
# Tail logs in real-time
wrangler tail ticker-backend-worker

# In another terminal, trigger the scheduled function
# (This requires the worker to be deployed)
wrangler tail ticker-backend-worker --format=pretty
```

## Configuration Summary

| Setting | Value |
|---------|-------|
| **Worker Name** | `ticker-backend-worker` |
| **Cron Schedule** | `0 9 * * *` (Daily at 9:00 AM UTC) |
| **API Base URL** | `https://ticker-backend-fw3jr13tb-thilinas-projects-f6f25033.vercel.app` |
| **API Key** | `tk_demo_key_12345` |
| **Environment** | `production` |

## What the Worker Does

1. **Health Check**: Verifies main API is accessible
2. **Process Queue**: Calls `POST /api/process-queue` on your main API
3. **Monitor Stats**: Gets job statistics via `GET /api/jobs`  
4. **Cleanup**: Monitors old job records (logging only)
5. **Error Handling**: Comprehensive logging and error reporting

## Troubleshooting

### Common Issues

1. **"API token required" error**:
   - Ensure `CLOUDFLARE_API_TOKEN` is exported in your environment
   - Verify token has correct permissions

2. **"Unknown worker" error**:
   - Worker name conflicts - try changing `name` in `wrangler.toml`

3. **Cron not executing**:
   - Check Cloudflare dashboard → Workers → Triggers
   - Verify account isn't on free tier limits

### Debug Commands

```bash
# Check current authentication
wrangler whoami

# List existing workers
wrangler list

# View live logs
wrangler tail ticker-backend-worker --format=pretty

# Delete worker (if needed)
wrangler delete ticker-backend-worker
```

## Cost Considerations

- **Free Tier**: 100,000 requests/day
- **Cron Jobs**: Count as requests (1 per day = ~30/month)
- **API Calls**: Each HTTP request from worker counts
- **Expected Usage**: <50 requests/month (well within free tier)

## Next Steps After Deployment

1. **Monitor First Execution**: Wait for 9 AM UTC and check logs
2. **Verify API Integration**: Ensure your main API receives the calls
3. **Update Documentation**: Record your actual worker URL
4. **Set Up Alerts** (optional): Configure Cloudflare notifications

Your Cloudflare Worker will now handle cron job scheduling, eliminating the Vercel hobby plan limitations!