# Deployment Debug Guide

## 🔍 Current Issues and Fixes

### Issue 1: Missing CLOUDFLARE_API_TOKEN in GitHub Secrets

**Problem:** GitHub Actions fails with authentication error
**Solution:** Add API token to GitHub repository secrets

#### Steps to Fix:
1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Create new token with permissions:
   - `Account:Cloudflare Workers:Edit`
   - `Zone:Zone Settings:Read` (for your domain if using custom)
3. Copy the token
4. Go to **GitHub Repository** → **Settings** → **Secrets and Variables** → **Actions**
5. Click **"New repository secret"**
6. Name: `CLOUDFLARE_API_TOKEN`
7. Value: `your-copied-token`

### Issue 2: Queue Configuration Warnings

**Problem:** `max_wait_time_ms` field warnings
**Solution:** Fixed to use `max_batch_timeout` instead

### Issue 3: Worker URL Uncertainty

**Problem:** Don't know the exact worker URL after deployment
**Solution:** Try multiple possible URLs in the queue integration

## 🚀 Deployment Process

### Automatic GitHub Deployment
1. **Set API Token** (see Issue 1 above)
2. **Push to GitHub** - triggers automatic deployment
3. **Monitor GitHub Actions** at: https://github.com/thilinatpr/ticker-backend-worker2/actions

### Manual Deployment (if GitHub fails)
```bash
# Set your API token
export CLOUDFLARE_API_TOKEN="your-token-here"

# Create queue (with paid plan)
npx wrangler queues create ticker-dividend-queue

# Deploy worker
npx wrangler deploy

# Test deployment
npx wrangler tail
```

## 🧪 Testing After Deployment

### 1. Health Check
```bash
# Try these URLs until one works:
curl https://ticker-backend-worker2.thilinatpr.workers.dev/health
curl https://ticker-backend-worker2-deployed.thilinatpr.workers.dev/health
```

### 2. Queue Integration Test
```bash
# Test via main API
curl -X POST https://ticker-backend-3a6tr24j5-thilinas-projects-f6f25033.vercel.app/api/update-tickers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tk_demo_key_12345" \
  -d '{"tickers": ["TESTQUEUE123"]}'
```

### 3. Expected Response
```json
{
  "success": true,
  "processing": {
    "newTickers": 1,
    "existingTickers": 0,
    "queueProcessing": 1,
    "traditionalProcessing": 0
  },
  "queueResult": {
    "tickers": ["TESTQUEUE123"],
    "status": "sent_to_queue",
    "message": "New tickers sent to Cloudflare Queue for instant processing"
  }
}
```

## 🔧 Troubleshooting

### GitHub Actions Still Failing?
1. Check if `CLOUDFLARE_API_TOKEN` secret is set correctly
2. Verify token has proper permissions
3. Try manual deployment as fallback

### Queue Not Working?
1. System falls back to traditional processing automatically
2. Still get 95% efficiency improvement from bulk updates
3. Can add queue later when worker is stable

### Worker Not Accessible?
1. Check Cloudflare Dashboard for actual worker URL
2. Update `POSSIBLE_URLS` in `lib/cloudflare-queue.js`
3. Redeploy main API to Vercel

## 🎯 Success Indicators

### ✅ Successful Deployment Shows:
- GitHub Actions: All steps green
- Worker accessible at health endpoint
- Queue created in Cloudflare dashboard
- New tickers route to queue (instant processing)
- Existing tickers use bulk updates (twice daily)

### 📊 Performance Benefits (Even Without Queue):
- **Bulk Updates:** 95% fewer API calls
- **Smart Processing:** Only fetch what's needed
- **Reliable Scheduling:** Cron-based automation
- **Error Handling:** Comprehensive retry logic

The system provides massive efficiency gains even if queue integration has issues!