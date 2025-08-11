# Manual Deployment Steps

Since OAuth isn't persisting in this environment, here are the manual deployment options:

## Option 1: Deploy via Cloudflare Dashboard

### Step 1: Create Worker in Dashboard
1. Go to https://dash.cloudflare.com/workers
2. Click **"Create Worker"**
3. Name it: `ticker-backend-worker`

### Step 2: Copy Worker Code
Copy this code into the dashboard editor:

```javascript
import { JobProcessor } from './job-processor.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ticker-backend-worker'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Ticker Backend Worker - Use /health for status', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  },

  async scheduled(_event, env) {
    console.log('Cron job triggered at:', new Date().toISOString());
    
    try {
      const processor = new JobProcessor(env);
      
      // Perform health check first
      const isHealthy = await processor.performHealthCheck();
      if (!isHealthy) {
        console.error('API health check failed, skipping job processing');
        return;
      }
      
      // Process the job queue
      await processor.processQueue();
      
      // Get current job statistics
      await processor.getJobStats();
      
      // Clean up old jobs (if needed)
      await processor.cleanupOldJobs();
      
      console.log('Scheduled job completed successfully');
    } catch (error) {
      console.error('Scheduled job failed:', error);
      throw error;
    }
  }
};

class JobProcessor {
  constructor(env) {
    this.env = env;
    this.apiBaseUrl = env.TICKER_API_BASE_URL;
    this.apiKey = env.TICKER_API_KEY;
  }

  async processQueue() {
    if (!this.apiBaseUrl || !this.apiKey) {
      throw new Error('Missing required environment variables: TICKER_API_BASE_URL, TICKER_API_KEY');
    }

    console.log('Starting queue processing...');
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/process-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': 'CloudflareWorker/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Queue processing failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Queue processing completed:', result);
      return result;
      
    } catch (error) {
      console.error('Queue processing error:', error);
      throw error;
    }
  }

  async getJobStats() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/jobs?limit=10`, {
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get job stats: ${response.status}`);
      }

      const stats = await response.json();
      console.log('Current job stats:', stats);
      return stats;
      
    } catch (error) {
      console.error('Failed to get job stats:', error);
      return null;
    }
  }

  async cleanupOldJobs() {
    console.log('Cleaning up old completed jobs...');
    
    try {
      // Get jobs older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const response = await fetch(`${this.apiBaseUrl}/api/jobs?status=completed&before=${sevenDaysAgo.toISOString()}`, {
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      if (response.ok) {
        const oldJobs = await response.json();
        console.log(`Found ${oldJobs.jobs?.length || 0} old jobs for cleanup`);
        
        // Note: Actual cleanup would require a DELETE endpoint in your API
        // This is just monitoring for now
      }
      
    } catch (error) {
      console.error('Cleanup job failed:', error);
    }
  }

  async performHealthCheck() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/health`);
      
      if (response.ok) {
        const health = await response.json();
        console.log('API health check passed:', health);
        return true;
      } else {
        console.error('API health check failed:', response.status);
        return false;
      }
      
    } catch (error) {
      console.error('Health check error:', error);
      return false;
    }
  }
}
```

### Step 3: Set Environment Variables
In the dashboard, go to **Settings** → **Environment Variables**:

- `TICKER_API_BASE_URL` = `https://ticker-backend-fw3jr13tb-thilinas-projects-f6f25033.vercel.app`
- `TICKER_API_KEY` = `tk_demo_key_12345`

### Step 4: Configure Cron Trigger
1. Go to **Triggers** tab
2. Click **"Add Cron Trigger"**
3. Set cron expression: `0 9 * * *`
4. Save

## Option 2: Try Global API Key in Terminal

If you want to try the CLI approach:

1. Get your Global API Key from https://dash.cloudflare.com/profile/api-tokens
2. Run these commands:

```bash
unset CLOUDFLARE_API_TOKEN
export CLOUDFLARE_EMAIL="patprathnayaka@gmail.com"  
export CLOUDFLARE_API_KEY="your-global-api-key"
cd /root/ticker-backend/cloudflare-worker
wrangler deploy --config wrangler-simple.toml
```

## ✅ Test After Deployment

Once deployed (either method), test:

```bash
# Test health endpoint (replace with your worker URL)
curl https://ticker-backend-worker.your-subdomain.workers.dev/health
```

**The manual dashboard approach is the most reliable way to get this deployed! 🚀**