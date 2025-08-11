# Use Global API Key for Deployment

Since OAuth login is having scope issues, let's use the **Global API Key** approach which provides full account access.

## 🔑 Get Your Global API Key

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Scroll down to **"Global API Key"** section  
3. Click **"View"** 
4. Copy the Global API Key

## 🚀 Deploy with Global API Key

```bash
# Clear any existing tokens
unset CLOUDFLARE_API_TOKEN

# Set email and Global API Key
export CLOUDFLARE_EMAIL="patprathnayaka@gmail.com"
export CLOUDFLARE_API_KEY="your-global-api-key-here"

# Deploy the worker
cd /root/ticker-backend/cloudflare-worker
wrangler deploy --config wrangler-simple.toml
```

## ✅ Why This Works

Global API Key provides:
- ✅ Full account access (bypasses `/memberships` API issues)
- ✅ All zone permissions
- ✅ All worker permissions  
- ✅ No scope limitations

## 🔒 Security Note

Global API Key has full account access, so:
- Use it only for initial deployment
- Consider switching back to scoped tokens later for production
- Keep it secure and don't commit to version control

## 📋 Alternative: Manual Deployment

If API access continues to fail, you can also:
1. **Upload via Dashboard**: Go to Cloudflare Dashboard → Workers → Create Worker
2. **Copy/paste code** from `src/index.js` and `src/job-processor.js`
3. **Set environment variables** manually in the dashboard
4. **Configure cron trigger** in the dashboard

---

**Get your Global API Key and let me know - that should definitely work! 🔑**