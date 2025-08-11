# 🚀 Manual Cloudflare Worker Deployment Instructions

## ⚠️ API Token Required

The automated deployment requires a Cloudflare API token. Follow these steps for manual deployment:

---

## 🔑 **Option 1: Set API Token and Deploy via CLI**

### 1. Get API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Copy the generated token

### 2. Set Environment Variable
```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
```

### 3. Deploy Worker
```bash
cd /root/ticker-backend/ticker-backend-worker2-deployed
wrangler deploy
```

---

## 🖥️ **Option 2: Manual Dashboard Deployment**

### 1. Go to Cloudflare Dashboard
- Visit https://dash.cloudflare.com/workers
- Click "Create Worker"
- Name: `ticker-backend-worker2`

### 2. Copy Worker Code
Copy the contents from `src/index.js`:
```javascript
// Copy the entire contents of src/index.js
```

### 3. Set Environment Variables
In the Worker settings, add:
```
TICKER_API_BASE_URL = https://ticker-backend-3a6tr24j5-thilinas-projects-f6f25033.vercel.app
TICKER_API_KEY = tk_demo_key_12345
```

### 4. Add Cron Trigger
- Go to Triggers tab
- Add cron: `0 9 * * *` (Daily at 9 AM UTC)
- Save and Deploy

---

## 🧪 **Option 3: Test Worker Functionality Locally**

Test the worker logic without deployment:

```bash
# Test the worker's main function
node -e "
const { JobProcessor } = require('./src/job-processor.js');
const env = {
  TICKER_API_BASE_URL: 'https://ticker-backend-3a6tr24j5-thilinas-projects-f6f25033.vercel.app',
  TICKER_API_KEY: 'tk_demo_key_12345'
};

const processor = new JobProcessor(env);
processor.processQueue().then(result => {
  console.log('✅ Worker test successful:', result);
}).catch(error => {
  console.error('❌ Worker test failed:', error.message);
});
"
```

---

## ✅ **Current Configuration Status**

The worker configuration has been updated with:

✅ **API URL:** https://ticker-backend-3a6tr24j5-thilinas-projects-f6f25033.vercel.app  
✅ **API Key:** tk_demo_key_12345 (demo key)  
✅ **Cron Schedule:** 0 9 * * * (Daily at 9 AM UTC)  
✅ **Code:** Latest version with error handling  

---

## 🔄 **What the Worker Does**

1. **Daily Cron Trigger:** Runs at 9 AM UTC
2. **Health Check:** Verifies main API is accessible
3. **Queue Processing:** Calls `/api/process-queue` to process dividend updates
4. **Job Monitoring:** Checks job statistics
5. **Error Handling:** Logs failures and handles retries

---

## 📊 **Expected Behavior**

When deployed and triggered, the worker will:

1. Check API health: `GET /api/health`
2. Process queue: `POST /api/process-queue` 
3. Monitor jobs: `GET /api/jobs`
4. Log results to Cloudflare

**The main API is already fixed and ready to receive worker requests!**

---

## 🎯 **Next Steps**

1. Choose deployment option (CLI with token or Dashboard)
2. Deploy the worker
3. Verify cron trigger is set
4. Monitor daily execution logs

The system will then be fully automated for daily dividend data updates! 🎉