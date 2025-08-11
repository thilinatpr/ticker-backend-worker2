# Manual Cron Trigger Setup

Due to compatibility issues with older Wrangler versions in the deploy environment, the cron trigger needs to be added manually after deployment.

## ✅ Step 1: Deploy Worker First

Click the deploy button to deploy the worker **without** cron triggers:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/thilinatpr/ticker-backend-cloudflare-worker)

You should see: **✨ Successfully published ticker-backend-worker**

## 🕒 Step 2: Add Cron Trigger Manually

1. **Go to Cloudflare Dashboard**
   - Visit https://dash.cloudflare.com/workers
   - Click on **"ticker-backend-worker"**

2. **Add Cron Trigger**
   - Click the **"Triggers"** tab
   - Click **"Add Cron Trigger"** 
   - Enter cron expression: `0 9 * * *`
   - Click **"Add Trigger"**

3. **Verify Setup**
   - You should see: **"Daily at 9:00 AM UTC"**
   - Status should show as **"Active"**

## 🧪 Step 3: Test Your Worker

### Test Health Endpoint
```bash
curl https://ticker-backend-worker.YOUR_SUBDOMAIN.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-08-11T...",
  "service": "ticker-backend-worker"
}
```

### Monitor Cron Execution
- Go to **Logs** tab in the dashboard
- Wait for 9:00 AM UTC or test cron manually
- Look for log entries from the scheduled function

## 🔧 What the Cron Job Does

Every day at 9:00 AM UTC, your worker will:

1. **Health Check**: Verify your main API is accessible
2. **Process Queue**: Call `POST /api/process-queue` on your ticker backend
3. **Monitor Stats**: Get job statistics via `GET /api/jobs`
4. **Log Results**: Comprehensive logging for monitoring

## 🎯 Expected Cron Log Output

```
Cron job triggered at: 2025-08-11T09:00:00.000Z
API health check passed: {status: "ok", ...}
Starting queue processing...
Queue processing completed: {processed: X, ...}
Current job stats: {total: X, pending: Y, ...}
Scheduled job completed successfully
```

## 🚨 Troubleshooting

### Common Issues

1. **Cron not appearing in dashboard**
   - Refresh the page
   - Check if worker deployed successfully
   - Verify you're in the correct account

2. **Cron not executing**
   - Check the **"Logs"** tab for errors
   - Verify environment variables are set correctly
   - Test the health endpoint first

3. **API calls failing**
   - Verify `TICKER_API_BASE_URL` is correct
   - Check that `tk_demo_key_12345` is valid
   - Test your main API health endpoint

---

**This manual setup is a one-time workaround. Once deployed, your worker will run reliably every day! 🚀**