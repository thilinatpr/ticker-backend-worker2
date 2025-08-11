# Cloudflare API Token Troubleshooting

## Current Issue
The deployment fails with:
```
✘ A request to the Cloudflare API (/memberships) failed.
Authentication error [code: 10000]
```

## Root Cause
The `/memberships` API endpoint requires **Account-level permissions** that are currently missing from your token.

## 🛠️ SOLUTION: Create New Token with Template

**The easiest fix is to use Cloudflare's pre-built template:**

### Step 1: Delete Current Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Find your current token
3. Click **"Delete"** (we'll create a new one)

### Step 2: Create Token with Template
1. Click **"Create Token"**
2. Select **"Edit Cloudflare Workers"** template
3. This template includes ALL required permissions:
   - ✅ Account:Cloudflare Workers:Edit
   - ✅ Account:Account Settings:Read  
   - ✅ Zone:Zone Settings:Read
   - ✅ Zone:Zone:Read
   - ✅ User:User Details:Read

### Step 3: Deploy
```bash
export CLOUDFLARE_API_TOKEN="your-new-template-token"
cd /root/ticker-backend/cloudflare-worker
wrangler deploy --config wrangler-simple.toml
```

## 🔧 Alternative: Manual Permission Fix

If you prefer to keep your current token, add these missing permissions:

**Account permissions needed:**
- `Account:Cloudflare Workers:Edit` ✅ (you have this)
- `Account:Account Settings:Read` ❌ (missing - this causes the error)
- `Account:Memberships:Read` ❌ (missing - may be needed)

## 🧪 Test Token After Update

```bash
# Test basic auth
CLOUDFLARE_API_TOKEN="your-token" wrangler whoami

# Test deployment
CLOUDFLARE_API_TOKEN="your-token" wrangler deploy --config wrangler-simple.toml
```

## ✅ Expected Success Output

When the token works correctly, you should see:
```
✨ Successfully published ticker-backend-worker
  https://ticker-backend-worker.your-subdomain.workers.dev
  
Cron Triggers:
  0 9 * * * (Daily at 9:00 AM UTC)
```

## 📞 If Still Having Issues

The Cloudflare Workers template should resolve this. If it still fails:

1. **Double-check account**: Make sure you're using the correct Cloudflare account
2. **Try browser login**: Use `wrangler login` if API token continues to fail
3. **Contact support**: The `/memberships` endpoint might have specific requirements

## 🎯 Why This Happens

Cloudflare's API token permissions are very granular. The `/memberships` endpoint specifically requires account-level read permissions that aren't always obvious when creating custom tokens. Using their pre-built "Edit Cloudflare Workers" template avoids these permission gaps.

---

**TL;DR: Use the "Edit Cloudflare Workers" template when creating your API token - it has all the right permissions! 🚀**