# Ticker Backend Cloudflare Worker 🚀

A Cloudflare Worker that provides reliable cron job functionality for the ticker backend API, handling scheduled dividend data updates and job processing.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/thilinatpr/ticker-backend-cloudflare-worker)

## 🌟 Features

- **Daily Cron Jobs**: Scheduled execution at 9:00 AM UTC
- **Health Monitoring**: API health checks before processing  
- **Queue Processing**: Triggers main API job processing endpoint
- **Job Statistics**: Monitors job queue status
- **Error Handling**: Comprehensive logging and retry logic
- **Rate Limiting**: Respects external API limits

## 🚀 Quick Deploy

### Option 1: Deploy Button (Recommended)
Click the deploy button above to automatically:
1. Fork this repository
2. Connect to Cloudflare Workers
3. Deploy with guided setup

### Option 2: Manual Dashboard Deployment

1. **Go to Cloudflare Dashboard**
   - Visit https://dash.cloudflare.com/workers
   - Click "Create Worker"
   - Name: `ticker-backend-worker`

2. **Copy Worker Code**
   - Copy contents from `src/index.js` 
   - Paste into Cloudflare editor

3. **Set Environment Variables**
   ```
   TICKER_API_BASE_URL = https://your-api-domain.vercel.app
   TICKER_API_KEY = your-api-key-here
   ```

4. **Add Cron Trigger**
   - Go to Triggers tab
   - Add cron: `0 9 * * *`
   - Save and Deploy

### Option 3: CLI Deployment

```bash
# Clone repository
git clone https://github.com/thilinatpr/ticker-backend-cloudflare-worker.git
cd ticker-backend-cloudflare-worker

# Install dependencies
npm install

# Set up authentication (choose one):
# Option A: API Token
export CLOUDFLARE_API_TOKEN="your-token"

# Option B: Global API Key  
export CLOUDFLARE_EMAIL="your-email"
export CLOUDFLARE_API_KEY="your-global-key"

# Configure environment
cp wrangler.example.toml wrangler.toml
# Edit wrangler.toml with your API URL and key

# Deploy
npm run deploy
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TICKER_API_BASE_URL` | Base URL of your ticker backend API | ✅ |
| `TICKER_API_KEY` | API key for authentication | ✅ |

### Cron Schedule

Default: `0 9 * * *` (Daily at 9:00 AM UTC)

Modify in `wrangler.toml`:
```toml
[[triggers.crons]]
cron = "0 */6 * * *"  # Every 6 hours
```

## 🧪 Testing

### Local Development
```bash
npm run dev
curl http://localhost:8787/health
```

### Production Testing
```bash
# Test health endpoint
curl https://ticker-backend-worker.your-subdomain.workers.dev/health

# Monitor logs
npm run tail
```

## 📋 What It Does

1. **Health Check**: Verifies main API accessibility (`GET /api/health`)
2. **Process Queue**: Triggers job processing (`POST /api/process-queue`) 
3. **Monitor Stats**: Collects job statistics (`GET /api/jobs`)
4. **Cleanup**: Monitors old job records for maintenance
5. **Error Handling**: Logs and handles failures gracefully

## 🔧 Development

### Project Structure
```
├── src/
│   ├── index.js           # Main worker entry point
│   └── job-processor.js   # Job processing logic
├── wrangler.toml          # Cloudflare configuration
├── wrangler.example.toml  # Configuration template
├── package.json           # Dependencies and scripts
└── .github/
    └── workflows/
        └── deploy.yml     # GitHub Actions deployment
```

### Scripts
```bash
npm run dev      # Local development
npm run deploy   # Deploy to production
npm run tail     # View live logs
```

### GitHub Actions Deployment

Automatically deploys on push to `main` branch:

1. **Set Repository Secrets**:
   - `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
   - `TICKER_API_BASE_URL` - Your API base URL
   - `TICKER_API_KEY` - Your API key

2. **Push to main branch** - Automatic deployment

## 💰 Cost

**Free Tier**: 100,000 requests/day
- Daily cron job: ~30 requests/month
- API calls: ~60 requests/month  
- **Total**: <100 requests/month (well within free limits)

## 🔍 Monitoring

### Cloudflare Dashboard
- **Workers** → **ticker-backend-worker** → **Logs**
- Monitor cron executions and errors
- View performance metrics

### CLI Monitoring
```bash
# Real-time logs
npm run tail

# Check deployment status
wrangler deployments list
```

## 🚨 Troubleshooting

### Common Issues

1. **Cron not triggering**
   - Check trigger configuration in dashboard
   - Verify account isn't on free tier limits

2. **API calls failing**
   - Verify environment variables
   - Check API key permissions
   - Test main API health

3. **Deployment errors**
   - Ensure proper authentication
   - Check API token permissions
   - Review error logs

### Debug Commands
```bash
# Check auth status
wrangler whoami

# Test configuration
wrangler dev

# View detailed logs
wrangler tail ticker-backend-worker --format=pretty
```

## 📚 Integration

This worker integrates with your existing ticker backend by:

- **Calling** `POST /api/process-queue` to trigger job processing
- **Monitoring** `GET /api/health` for API availability
- **Tracking** `GET /api/jobs` for queue statistics
- **Logging** all operations for monitoring

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Main API**: [Ticker Backend](https://github.com/thilinatpr/ticker-backend)
- **Cloudflare Workers Docs**: [workers.cloudflare.com](https://workers.cloudflare.com)
- **Cron Expression Helper**: [crontab.guru](https://crontab.guru)

---

**Built with ❤️ for reliable dividend data processing**